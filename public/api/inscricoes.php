<?php
// api/inscricoes.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$acao = $_GET['acao'] ?? 'listar';

// ===================================================================================
// 0. SEGURANÇA E AUTENTICAÇÃO
// ===================================================================================
$adminUser = null;
$tokenData = null;

// Função universal para obter headers (Compatível com Apache e Nginx)
function get_auth_header() {
    $authHeader = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = trim($_SERVER['HTTP_AUTHORIZATION']);
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    return $authHeader;
}

// ADICIONADO: Exceção para 'turnos_publicos'
if ($acao !== 'nova' && $acao !== 'config_turnos' && $acao !== 'turnos_publicos') {
    $authHeader = get_auth_header();

    // A. Tenta Autenticação ADMIN (JWT)
    if ($authHeader) {
        $adminUser = verificarAuth(); 
    } 
    // B. Tenta Autenticação COORDENADOR (Token + PIN)
    elseif (isset($_GET['token'])) {
        $token = $_GET['token'];
        
        $stmt = $pdo->prepare("SELECT * FROM access_tokens WHERE token = ? AND expira_em > NOW()");
        $stmt->execute([$token]);
        $tokenData = $stmt->fetch();

        if (!$tokenData) {
            http_response_code(403); echo json_encode(["erro" => "Link inválido ou expirado"]); exit();
        }

        // Captura o PIN de forma segura
        $pinEnviado = '';
        if (function_exists('getallheaders')) {
            $h = getallheaders();
            $pinEnviado = $h['X-Access-Pin'] ?? $h['x-access-pin'] ?? '';
        } else {
            $pinEnviado = $_SERVER['HTTP_X_ACCESS_PIN'] ?? '';
        }

        if (!password_verify($pinEnviado, $tokenData['pin_hash'])) {
            http_response_code(401); echo json_encode(["erro" => "PIN necessário", "requer_pin" => true]); exit();
        }
    } 
    // C. Sem Autenticação
    else {
        http_response_code(401); echo json_encode(["erro" => "Não autorizado"]); exit();
    }
}

// ===================================================================================
// 1. GET (LEITURA)
// ===================================================================================
if ($method === 'GET') {

    // NOVO: Endpoint público para ver turnos disponíveis e preços sem expor dados
    if ($acao === 'turnos_publicos') {
        $localReq = $_GET['local'] ?? 'quinta';

        // 1. Obter a configuração dos turnos
        $stmt = $pdo->prepare("SELECT valor FROM configuracoes WHERE chave = 'turnos'");
        $stmt->execute();
        $res = $stmt->fetch();
        $config = $res ? json_decode($res['valor'], true) : [];
        $turnosLocal = $config[$localReq] ?? [];

        // 2. Contar quantas inscrições existem por turno neste local
        $mapaLocais = ['quinta' => 'Quinta', 'costaCaparica' => 'Costa da Caparica', 'quiaios' => 'Quiaios'];
        $localSql = $mapaLocais[$localReq] ?? 'Quinta';

        $stmtCount = $pdo->prepare("SELECT turno, COUNT(id) as total FROM inscricoes WHERE local = ? GROUP BY turno");
        $stmtCount->execute([$localSql]);
        $contagens = $stmtCount->fetchAll(PDO::FETCH_KEY_PAIR); // Devolve array: ['Turno 1' => 45]

        // 3. Filtrar turnos passados e preparar dados de envio
        $turnosDisponiveis = [];
        foreach ($turnosLocal as $t) {
            if (!isset($t['ativo']) || !$t['ativo']) continue;

            $limite = $t['limite'] ?? 80;
            $precoBase = $t['precoBase'] ?? 300;
            $inscritos = $contagens[$t['nome']] ?? 0;
            $esgotado = !empty($t['esgotado']) || ($inscritos >= $limite);

            $turnosDisponiveis[] = [
                'nome'          => $t['nome'],
                'precoBase'     => (float)$precoBase,
                'vagasRestantes'=> max(0, $limite - $inscritos),
                'esgotado'      => $esgotado
            ];
        }

        echo json_encode($turnosDisponiveis);
        exit;
    }

    if ($acao === 'config_turnos') {
        $stmt = $pdo->prepare("SELECT valor FROM configuracoes WHERE chave = 'turnos'");
        $stmt->execute();
        $res = $stmt->fetch();
        echo $res ? $res['valor'] : '{}';
        exit;
    }

    if ($acao === 'listar') {
        try {
            // QUERY: Busca tudo. 
            $sqlBase = "
                SELECT 
                    i.*, 
                    p.nome_completo, p.data_nascimento, p.genero,
                    p.email_ee, p.nome_ee, p.telefone_ee, p.nif_ee, p.contacto_emergencia,
                    p.intolerancias, p.medicacao, p.tamanho_tshirt,
                    p.morada, p.cc, p.nif, p.sistema_saude
                FROM inscricoes i
                JOIN participantes p ON i.participante_id = p.id
            ";

            if ($tokenData) {
                $localKey = $tokenData['local']; 
                $mapaLocais = ['quinta' => 'Quinta', 'costaCaparica' => 'Costa da Caparica', 'quiaios' => 'Quiaios'];
                $localSql = $mapaLocais[$localKey] ?? 'Quinta';

                $sql = $sqlBase . " WHERE i.local = ? ORDER BY p.nome_completo ASC";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$localSql]);
                $todas = $stmt->fetchAll();

                $turnosPermitidos = json_decode($tokenData['turnos_permitidos'], true) ?? [];
                $result = array_values(array_filter($todas, function($row) use ($turnosPermitidos) {
                    return in_array($row['turno'], $turnosPermitidos);
                }));
            } else {
                $sql = $sqlBase . " ORDER BY p.nome_completo ASC";
                $stmt = $pdo->prepare($sql);
                $stmt->execute();
                $result = $stmt->fetchAll();
            }

            // --- MAPEAMENTO ---
            foreach ($result as &$row) {
                
                // Garantir que os IDs relacionais são enviados (cast para int ou null)
                $row['camarata_id'] = isset($row['camarata_id']) ? (int)$row['camarata_id'] : null;
                $row['grupo_id']    = isset($row['grupo_id']) ? (int)$row['grupo_id'] : null;

                $row['tipoCliente'] = $row['tipo_cliente'] ?? 'individual';
                $row['nomeInstituicao'] = $row['nome_instituicao'] ?? null;
                $row['dataPagamento'] = $row['dataPagamento'] ?? null;
                $row['nomePagamento'] = $row['nomePagamento'] ?? null;
                $row['numeroFatura'] = $row['numeroFatura'] ?? null;

                $row['participante'] = [
                    'nomeCompleto'   => $row['nome_completo'],
                    'dataNascimento' => $row['data_nascimento'],
                    'genero'         => $row['genero'],
                    'nif'            => $row['nif'] ?? '',
                    'cc'             => $row['cc'] ?? '',
                    'codigoPostal'   => $row['morada'] ?? '',
                    'sistemaSaude'   => $row['sistema_saude'] ?? '',
                    'tamanhoTshirt'  => $row['tamanho_tshirt'] ?? 'S'
                ];

                $row['ee'] = [
                    'nome'               => $row['nome_ee'],
                    'email'              => $row['email_ee'],
                    'telefone'           => $row['telefone_ee'],
                    'nif'                => $row['nif_ee'] ?? '',
                    'contactoEmergencia' => $row['contacto_emergencia'] ?? ''
                ];

                $row['saude'] = [
                    'temAlergiaAlimentar'     => !empty($row['intolerancias']),
                    'detalheAlergiaAlimentar' => $row['intolerancias'],
                    'tomaMedicacao'            => !empty($row['medicacao']),
                    'detalheMedicacao'         => $row['medicacao']
                ];

                $row['checkin'] = [
                    'status'        => $row['checkin_status'] ?? 'pendente',
                    'dinheiroBolso' => $row['dinheiro_bolso'] ?? 0
                ];

                $row['turnoEscolhido']  = $row['turno'];
                $row['autorizaFotoVideo'] = (bool)$row['autoriza_foto_video'];
                $row['observacoes'] = $row['observacoes'] ?? '';
                
                // Limpeza
                unset($row['nome_completo'], $row['nome_ee'], $row['email_ee'], $row['telefone_ee'], $row['nif_ee'], $row['contacto_emergencia'],
                      $row['intolerancias'], $row['medicacao'], $row['tamanho_tshirt'], $row['morada'], $row['cc'], $row['nif'], $row['sistema_saude']);
            }
            
            echo json_encode($result);
            exit;

        } catch (Exception $e) {
            http_response_code(500);
            $msg = $is_dev_request ? 'Erro na consulta: ' . $e->getMessage() : 'Erro interno.';
            echo json_encode(['erro' => $msg]);
            exit;
        }
    }
}

// ===================================================================================
// 2. POST / PUT (GRAVAÇÃO)
// ===================================================================================
if ($method === 'POST' || $method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);

    // A. Nova Inscrição
    if ($acao === 'nova') {
        $pdo->beginTransaction();
        try {
            // Verifica duplicado
            $stmtCheck = $pdo->prepare("SELECT id FROM participantes WHERE email_ee = ? AND nome_completo = ?");
            $stmtCheck->execute([$input['ee']['email'], $input['participante']['nomeCompleto']]);
            $participanteExistente = $stmtCheck->fetch();

            $participanteId = null;

            if ($participanteExistente) {
                $participanteId = $participanteExistente['id'];
            } else {
                $sqlPart = "INSERT INTO participantes 
                    (email_ee, nome_completo, data_nascimento, genero, 
                     nome_ee, telefone_ee, nif_ee, contacto_emergencia, intolerancias, medicacao,
                     morada, cc, nif, sistema_saude, tamanho_tshirt) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                
                $stmtPart = $pdo->prepare($sqlPart);
                $stmtPart->execute([
                    $input['ee']['email'],
                    $input['participante']['nomeCompleto'],
                    $input['participante']['dataNascimento'],
                    $input['participante']['genero'] ?? 'M',
                    $input['ee']['nome'],
                    $input['ee']['telefone'],
                    $input['ee']['nif'] ?? '',
                    $input['ee']['contactoEmergencia'] ?? '',
                    $input['saude']['alergiaDetalhes'] ?? '',
                    $input['saude']['medicacaoHabitual'] ?? '',
                    $input['participante']['codigoPostal'] ?? '',
                    $input['participante']['cc'] ?? '',
                    $input['participante']['nif'] ?? '',
                    $input['participante']['sistemaSaude'] ?? '',
                    $input['participante']['tamanhoTshirt'] ?? 'S'
                ]);
                $participanteId = $pdo->lastInsertId();
            }

            // CORREÇÃO: Inserção da inscrição garantindo compatibilidade com colunas institucionais
            $sqlInsc = "INSERT INTO inscricoes 
                (participante_id, turno, local, ano, valor_total, autoriza_foto_video, transporte, estado_pagamento, tipo_cliente, nome_instituicao, dataPagamento, nomePagamento, numeroFatura, observacoes) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?)";
            
            $stmtInsc = $pdo->prepare($sqlInsc);
            $stmtInsc->execute([
                $participanteId,
                $input['turnoEscolhido'],
                $input['local'],
                date('Y'),
                $input['valor_total'] ?? ($input['valorTotal'] ?? 300),
                isset($input['autorizaFotoVideo']) && $input['autorizaFotoVideo'] ? 1 : 0,
                $input['transporte'] ?? 'Não definido',
                $input['tipoCliente'] ?? 'individual',   
                $input['nomeInstituicao'] ?? null,
                $input['dataPagamento'] ?? null,
                $input['nomePagamento'] ?? null,
                $input['numeroFatura'] ?? null,
                $input['observacoes'] ?? null
            ]);

            $pdo->commit();
            echo json_encode(["id" => $pdo->lastInsertId()]);

        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['erro' => $is_dev_request ? 'Erro SQL: ' . $e->getMessage() : 'Erro interno.']);
        }
        exit;
    }

    // B. Batch Update (Edição Admin e Logística)
    if ($acao === 'batch_update') {
        if (isset($input['id'])) { $input = [$input]; }
        $pdo->beginTransaction();
        try {
            foreach ($input as $item) {
                $id = $item['id'];
                
                // Segurança Coordenador
                if ($tokenData) {
                    $checkStmt = $pdo->prepare("SELECT local, turno FROM inscricoes WHERE id = ?");
                    $checkStmt->execute([$id]);
                    $alvo = $checkStmt->fetch();
                    $mapaLocais = ['quinta' => 'Quinta', 'costaCaparica' => 'Costa da Caparica', 'quiaios' => 'Quiaios'];
                    $localPermitido = $mapaLocais[$tokenData['local']] ?? 'Quinta';
                    $turnosPermitidos = json_decode($tokenData['turnos_permitidos'], true) ?? [];
                    if (!$alvo || $alvo['local'] !== $localPermitido || !in_array($alvo['turno'], $turnosPermitidos)) {
                        continue;
                    }
                }

                $dados = $item['data'] ?? $item;
                $campos = [];
                $valores = [];

                if (isset($dados['camarata_id'])) { 
                    $campos[] = "camarata_id = ?"; 
                    $valores[] = $dados['camarata_id']; 
                } elseif (isset($dados['camarata']) && is_numeric($dados['camarata'])) {
                    $campos[] = "camarata_id = ?"; 
                    $valores[] = $dados['camarata']; 
                }
                
                if (isset($dados['grupo_id'])) { 
                    $campos[] = "grupo_id = ?"; 
                    $valores[] = $dados['grupo_id']; 
                } elseif (isset($dados['grupo']) && is_numeric($dados['grupo'])) {
                    $campos[] = "grupo_id = ?"; 
                    $valores[] = $dados['grupo']; 
                }

                if (isset($dados['estado_pagamento'])) { $campos[] = "estado_pagamento = ?"; $valores[] = $dados['estado_pagamento']; }
                if (isset($dados['transporte'])) { $campos[] = "transporte = ?"; $valores[] = $dados['transporte']; }
                if (isset($dados['autorizaFotoVideo'])) { $campos[] = "autoriza_foto_video = ?"; $valores[] = $dados['autorizaFotoVideo'] ? 1 : 0; }
                if (isset($dados['turnoEscolhido'])) { $campos[] = "turno = ?"; $valores[] = $dados['turnoEscolhido']; }
                if (isset($dados['valor_total'])) { $campos[] = "valor_total = ?"; $valores[] = (float)$dados['valor_total']; }
                if (isset($dados['dataPagamento'])) { $campos[] = "dataPagamento = ?"; $valores[] = $dados['dataPagamento']; }
                if (isset($dados['nomePagamento'])) { $campos[] = "nomePagamento = ?"; $valores[] = $dados['nomePagamento']; }
                if (isset($dados['numeroFatura'])) { $campos[] = "numeroFatura = ?"; $valores[] = $dados['numeroFatura']; }

                if (isset($dados['tipoCliente'])) { $campos[] = "tipo_cliente = ?"; $valores[] = $dados['tipoCliente']; }
                if (isset($dados['nomeInstituicao'])) { $campos[] = "nome_instituicao = ?"; $valores[] = $dados['nomeInstituicao']; }
                if (array_key_exists('observacoes', $dados)) { $campos[] = "observacoes = ?"; $valores[] = $dados['observacoes']; }

                if (isset($dados['checkin'])) {
                    if (isset($dados['checkin']['status'])) { $campos[] = "checkin_status = ?"; $valores[] = $dados['checkin']['status']; }
                    if (isset($dados['checkin']['dinheiroBolso'])) { $campos[] = "dinheiro_bolso = ?"; $valores[] = $dados['checkin']['dinheiroBolso']; }
                }

                if (!empty($campos)) {
                    $valores[] = $id;
                    $sql = "UPDATE inscricoes SET " . implode(', ', $campos) . " WHERE id = ?";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($valores);
                }

                if (isset($dados['participante']) || isset($dados['ee']) || isset($dados['saude'])) {
                    $stmtPid = $pdo->prepare("SELECT participante_id FROM inscricoes WHERE id = ?");
                    $stmtPid->execute([$id]);
                    $partId = $stmtPid->fetchColumn();

                    if ($partId) {
                        $camposPart = [];
                        $valoresPart = [];

                        if (isset($dados['participante']['nomeCompleto'])) { $camposPart[] = "nome_completo = ?"; $valoresPart[] = $dados['participante']['nomeCompleto']; }
                        
                        if (isset($dados['participante']['genero'])) { $camposPart[] = "genero = ?"; $valoresPart[] = $dados['participante']['genero']; }
                        
                        if (isset($dados['participante']['nif'])) { $camposPart[] = "nif = ?"; $valoresPart[] = $dados['participante']['nif']; }
                        if (isset($dados['participante']['cc'])) { $camposPart[] = "cc = ?"; $valoresPart[] = $dados['participante']['cc']; }
                        if (isset($dados['participante']['codigoPostal'])) { $camposPart[] = "morada = ?"; $valoresPart[] = $dados['participante']['codigoPostal']; }
                        if (isset($dados['participante']['sistemaSaude'])) { $camposPart[] = "sistema_saude = ?"; $valoresPart[] = $dados['participante']['sistemaSaude']; }
                        if (isset($dados['participante']['dataNascimento'])) { $camposPart[] = "data_nascimento = ?"; $valoresPart[] = $dados['participante']['dataNascimento']; }
                        if (isset($dados['participante']['tamanhoTshirt'])) { $camposPart[] = "tamanho_tshirt = ?"; $valoresPart[] = $dados['participante']['tamanhoTshirt']; }

                        if (isset($dados['ee']['nome'])) { $camposPart[] = "nome_ee = ?"; $valoresPart[] = $dados['ee']['nome']; }
                        if (isset($dados['ee']['email'])) { $camposPart[] = "email_ee = ?"; $valoresPart[] = $dados['ee']['email']; }
                        if (isset($dados['ee']['telefone'])) { $camposPart[] = "telefone_ee = ?"; $valoresPart[] = $dados['ee']['telefone']; }
                        if (isset($dados['ee']['nif'])) { $camposPart[] = "nif_ee = ?"; $valoresPart[] = $dados['ee']['nif']; }
                        if (isset($dados['ee']['contactoEmergencia'])) { $camposPart[] = "contacto_emergencia = ?"; $valoresPart[] = $dados['ee']['contactoEmergencia']; }

                        if (isset($dados['saude']['detalheAlergiaAlimentar'])) { $camposPart[] = "intolerancias = ?"; $valoresPart[] = $dados['saude']['detalheAlergiaAlimentar']; }
                        if (isset($dados['saude']['detalheMedicacao'])) { $camposPart[] = "medicacao = ?"; $valoresPart[] = $dados['saude']['detalheMedicacao']; }

                        if (!empty($camposPart)) {
                            $valoresPart[] = $partId;
                            $sqlPart = "UPDATE participantes SET " . implode(', ', $camposPart) . " WHERE id = ?";
                            $stmtPart = $pdo->prepare($sqlPart);
                            $stmtPart->execute($valoresPart);
                        }
                    }
                }
            }
            $pdo->commit();
            echo json_encode(["msg" => "OK"]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['erro' => $is_dev_request ? $e->getMessage() : 'Erro interno.']);
        }
        exit;
    }
    
    // Configurações
    if ($acao === 'salvar_config_turnos') {
        if (!$adminUser) { http_response_code(403); exit; }
        $stmt = $pdo->prepare("REPLACE INTO configuracoes (chave, valor) VALUES ('turnos', ?)");
        $stmt->execute([json_encode($input)]);
        echo json_encode(["msg" => "OK"]);
        exit;
    }
    
    // Delete
    if ($acao === 'apagar') {
        if (!$adminUser) { http_response_code(403); exit; }
        $id = $input['id'] ?? null;
        if ($id) {
            $stmt = $pdo->prepare("DELETE FROM inscricoes WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(["msg" => "Apagado"]);
        }
        exit;
    }
}
