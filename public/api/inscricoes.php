<?php
// api/inscricoes.php
require 'config.php';

// Importar as classes do PHPMailer
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Requerer os ficheiros do PHPMailer (ajusta o caminho se a pasta tiver outro nome)
require 'PHPMailer/src/Exception.php';
require 'PHPMailer/src/PHPMailer.php';
require 'PHPMailer/src/SMTP.php';

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

// Exceção para endpoints abertos
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

// IDENTIFICAÇÃO DO ATOR PARA OS LOGS DE AUDITORIA
$atorAtivo = 'Sistema/Público';
if ($adminUser) {
    $atorAtivo = $adminUser['email'];
} elseif ($tokenData) {
    $atorAtivo = $tokenData['nome_coordenador'] . ' (Coord)';
}

// ===================================================================================
// 1. GET (LEITURA)
// ===================================================================================
if ($method === 'GET') {

    // Endpoint público para ver turnos disponíveis e preços sem expor dados
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
        $contagens = $stmtCount->fetchAll(PDO::FETCH_KEY_PAIR);

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
                    p.intolerancias, p.medicacao,
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
                
                $row['camarata_id'] = isset($row['camarata_id']) ? (int)$row['camarata_id'] : null;
                $row['grupo_id']    = isset($row['grupo_id']) ? (int)$row['grupo_id'] : null;

                $row['tipoCliente'] = $row['tipo_cliente'] ?? 'individual';
                $row['nomeInstituicao'] = $row['nome_instituicao'] ?? null;
                $row['dataPagamento'] = $row['dataPagamento'] ?? null;
                $row['nomePagamento'] = $row['nomePagamento'] ?? null;
                $row['numeroFatura'] = $row['numeroFatura'] ?? null;

                $row['numeroBeneficiario'] = $row['numero_beneficiario'] ?? null;

                $row['participante'] = [
                    'nomeCompleto'   => $row['nome_completo'],
                    'dataNascimento' => $row['data_nascimento'],
                    'genero'         => $row['genero'],
                    'nif'            => $row['nif'] ?? '',
                    'cc'             => $row['cc'] ?? '',
                    'codigoPostal'   => $row['morada'] ?? '',
                    'sistemaSaude'   => $row['sistema_saude'] ?? ''
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
                    'tomaMedicacao'           => !empty($row['medicacao']),
                    'detalheMedicacao'        => $row['medicacao']
                ];

                $row['checkin'] = [
                    'status'        => $row['checkin_status'] ?? 'pendente',
                    'dinheiroBolso' => $row['dinheiro_bolso'] ?? 0
                ];

                $row['turnoEscolhido']  = $row['turno'];
                $row['autorizaFotoVideo'] = (bool)$row['autoriza_foto_video'];
                $row['observacoes'] = $row['observacoes'] ?? '';
                
                unset($row['nome_completo'], $row['nome_ee'], $row['email_ee'], $row['telefone_ee'], $row['nif_ee'], $row['contacto_emergencia'],
                      $row['intolerancias'], $row['medicacao'], $row['morada'], $row['cc'], $row['nif'], $row['sistema_saude']);
            }
            
            echo json_encode($result);
            exit;

        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode(['erro' => 'Erro na consulta', 'detalhe' => $e->getMessage()]);
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

        // --- VALIDAÇÃO: turno fechado ou esgotado ---
        $mapaLocaisValidacao = [
            'quinta'        => 'Quinta',
            'costaCaparica' => 'Costa da Caparica',
            'quiaios'       => 'Quiaios'
        ];
        $localValidacao  = $mapaLocaisValidacao[$input['local']] ?? $input['local'];
        $localChave      = $input['local'];
        $turnoEscolhido  = $input['turnoEscolhido'] ?? '';

        $stmtCfg = $pdo->prepare("SELECT valor FROM configuracoes WHERE chave = 'turnos'");
        $stmtCfg->execute();
        $resCfg  = $stmtCfg->fetch();
        $cfgTurnos = $resCfg ? json_decode($resCfg['valor'], true) : [];
        $turnosDoLocal = $cfgTurnos[$localChave] ?? [];

        $turnoConfig = null;
        foreach ($turnosDoLocal as $t) {
            if (($t['nome'] ?? '') === $turnoEscolhido) {
                $turnoConfig = $t;
                break;
            }
        }

        if (!$turnoConfig) {
            http_response_code(422);
            echo json_encode(['erro' => 'O turno selecionado não existe.']);
            exit;
        }

        if (empty($turnoConfig['ativo'])) {
            http_response_code(409);
            echo json_encode(['erro' => 'Este turno está fechado e não aceita novas inscrições.']);
            exit;
        }

        if (!empty($turnoConfig['esgotado'])) {
            http_response_code(409);
            echo json_encode(['erro' => 'Este turno está esgotado.']);
            exit;
        }

        $limite = $turnoConfig['limite'] ?? 80;
        $stmtContagem = $pdo->prepare("SELECT COUNT(*) FROM inscricoes WHERE turno = ? AND local = ?");
        $stmtContagem->execute([$turnoEscolhido, $localValidacao]);
        $totalInscritos = (int)$stmtContagem->fetchColumn();

        if ($totalInscritos >= $limite) {
            http_response_code(409);
            echo json_encode(['erro' => 'Este turno atingiu o limite de inscrições e está esgotado.']);
            exit;
        }
        // --- FIM DA VALIDAÇÃO ---

        $pdo->beginTransaction();
        try {
            // SOLUÇÃO: CONVERT EXPLICITO PARA EVITAR ERRO 1267 MIX DE COLLATIONS
            $stmtCheck = $pdo->prepare("SELECT id FROM participantes WHERE email_ee = CONVERT(? USING latin1) AND nome_completo = CONVERT(? USING latin1)");
            $stmtCheck->execute([$input['ee']['email'], $input['participante']['nomeCompleto']]);
            $participanteExistente = $stmtCheck->fetch();

            $participanteId = null;

            if ($participanteExistente) {
                $participanteId = $participanteExistente['id'];
            } else {
                $sqlPart = "INSERT INTO participantes 
                    (email_ee, nome_completo, data_nascimento, genero, 
                     nome_ee, telefone_ee, nif_ee, contacto_emergencia, intolerancias, medicacao,
                     morada, cc, nif, sistema_saude) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                
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
                    $input['saude']['alergiaDetalhes'] ?? $input['saude']['detalheAlergiaAlimentar'] ?? '',
                    $input['saude']['medicacaoHabitual'] ?? $input['saude']['detalheMedicacao'] ?? '',
                    $input['participante']['codigoPostal'] ?? '',
                    $input['participante']['cc'] ?? '',
                    $input['participante']['nif'] ?? '',
                    $input['participante']['sistemaSaude'] ?? ''
                ]);
                $participanteId = $pdo->lastInsertId();
            }

            $mapaLocaisFormal = [
                'quinta' => 'Quinta',
                'costaCaparica' => 'Costa da Caparica',
                'quiaios' => 'Quiaios'
            ];
            $localSalvar = $mapaLocaisFormal[$input['local']] ?? $input['local'];

            $sqlInsc = "INSERT INTO inscricoes 
                (participante_id, turno, local, ano, valor_total, autoriza_foto_video, transporte, estado_pagamento, tipo_cliente, nome_instituicao, dataPagamento, nomePagamento, numeroFatura, observacoes, numero_beneficiario) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?)";
            
            $stmtInsc = $pdo->prepare($sqlInsc);
            $stmtInsc->execute([
                $participanteId,
                $input['turnoEscolhido'],
                $localSalvar,
                date('Y'),
                $input['valor_total'] ?? ($input['valorTotal'] ?? 300),
                isset($input['autorizaFotoVideo']) && $input['autorizaFotoVideo'] ? 1 : 0,
                $input['transporte'] ?? 'Não definido',
                $input['tipoCliente'] ?? 'individual',   
                $input['nomeInstituicao'] ?? null,
                $input['dataPagamento'] ?? null,
                $input['nomePagamento'] ?? null,
                $input['numeroFatura'] ?? null,
                $input['observacoes'] ?? null,
                $input['numeroBeneficiario'] ?? null
            ]);
            
            $novaInscricaoId = $pdo->lastInsertId();

            $pdo->commit();

            registar_log(
                $pdo, 
                $atorAtivo, 
                'CREATE', 
                'inscricao', 
                $input['participante']['nomeCompleto'], 
                $input['ee']['email'], 
                ['turno' => $input['turnoEscolhido']]
            );

            // ==========================================================
            // PREPARAÇÃO DE EMAILS (Conteúdo)
            // ==========================================================
            $paraAdmin = 'info@quintadaescola.com';
            $assuntoAdmin = 'Nova Inscrição: ' . $input['participante']['nomeCompleto'] . ' - ' . $input['turnoEscolhido'];

            $mensagemAdmin = "
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                h2 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 20px; }
                .info-block { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #ddd; }
                p { margin: 5px 0; }
              </style>
            </head>
            <body>
                <h1>Nova Inscrição Recebida 🎉</h1>
                
                <div class='info-block'>
                    <h2>Resumo</h2>
                    <p><strong>Turno:</strong> {$input['turnoEscolhido']}</p>
                    <p><strong>Local:</strong> {$localSalvar}</p>
                    <p><strong>Nº Beneficiário:</strong> " . (!empty($input['numeroBeneficiario']) ? $input['numeroBeneficiario'] : '--') . "</p>
                    <p><strong>Tipo de Cliente:</strong> " . ucfirst($input['tipoCliente'] ?? 'individual') . "</p>
                    <p><strong>Transporte:</strong> {$input['transporte']}</p>
                    <p><strong>Valor Total:</strong> {$input['valor_total']}€</p>
                </div>

                <div class='info-block'>
                    <h2>Dados do Participante</h2>
                    <p><strong>Nome Completo:</strong> {$input['participante']['nomeCompleto']}</p>
                    <p><strong>Data de Nascimento:</strong> {$input['participante']['dataNascimento']}</p>
                    <p><strong>NIF:</strong> " . (!empty($input['participante']['nif']) ? $input['participante']['nif'] : 'Não preenchido') . "</p>
                    <p><strong>Cartão Cidadão:</strong> {$input['participante']['cc']}</p>
                    <p><strong>Sistema de Saúde:</strong> {$input['participante']['sistemaSaude']}</p>
                </div>

                <div class='info-block'>
                    <h2>Encarregado de Educação</h2>
                    <p><strong>Nome:</strong> {$input['ee']['nome']}</p>
                    <p><strong>Email:</strong> {$input['ee']['email']}</p>
                    <p><strong>Telemóvel:</strong> {$input['ee']['telefone']}</p>
                    <p><strong>Contacto de Emergência:</strong> " . (!empty($input['ee']['contactoEmergencia']) ? $input['ee']['contactoEmergencia'] : 'Não preenchido') . "</p>
                </div>

                <div class='info-block'>
                    <h2>Saúde e Cuidados</h2>
                    <p><strong>Alergias:</strong> " . (!empty($input['saude']['alergiaDetalhes']) ? $input['saude']['alergiaDetalhes'] : 'Nenhuma') . "</p>
                    <p><strong>Medicação Habitual:</strong> " . (!empty($input['saude']['medicacaoHabitual']) ? $input['saude']['medicacaoHabitual'] : 'Nenhuma') . "</p>
                </div>

                <div class='info-block'>
                    <h2>Observações</h2>
                    <p>" . (!empty($input['observacoes']) ? nl2br($input['observacoes']) : 'Sem observações.') . "</p>
                </div>
            </body>
            </html>
            ";

            $mail = new PHPMailer(true);

            try {
                $mail->isSMTP();
                $mail->Host       = 'mail.quintadaescola.com'; 
                $mail->SMTPAuth   = true;
                $mail->Username   = 'noreply@quintadaescola.com'; 
                $mail->Password   = 'hS99W+EanZwGHBIL';        
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; 
                $mail->Port       = 465; 
                $mail->CharSet    = 'UTF-8'; 

                $mail->setFrom('info@quintadaescola.com', 'Sistema Inscrições');
                $mail->addAddress($paraAdmin, 'Admin');
                
                $emailEE = $input['ee']['email'] ?? '';
                if (!empty($emailEE) && filter_var($emailEE, FILTER_VALIDATE_EMAIL)) {
                    $mail->addReplyTo($emailEE, $input['ee']['nome'] ?? '');
                } else {
                    $mail->addReplyTo('info@quintadaescola.com', 'Sistema Inscrições');
                }

                $mail->isHTML(true);
                $mail->Subject = $assuntoAdmin;
                $mail->Body    = $mensagemAdmin;

                $mail->send();
                $mail->clearAllRecipients();
                $mail->clearReplyTos();
                
                if (!empty($emailEE) && filter_var($emailEE, FILTER_VALIDATE_EMAIL)) {
                    $nomeEE = $input['ee']['nome'];
                    $turno = $input['turnoEscolhido'];
                    $valor = $input['valor_total'] ?? 0;

                    $assuntoEE = 'Confirmação de Inscrição - Quinta da Escola';
                    
                    $htmlEE = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
                        . 'body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f8;}'
                        . '.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;}'
                        . '.header{background:#2e7d32;padding:30px 20px;text-align:center;}'
                        . '.header h1{color:#fff;margin:0;font-size:24px;}'
                        . '.content{padding:40px 30px;color:#333;line-height:1.7;}'
                        . '.info-box{background:#f1f8e9;border-left:5px solid #2e7d32;padding:20px;margin:20px 0;border-radius:4px;}'
                        . '.label{font-weight:bold;color:#555;}'
                        . '.value{color:#2e7d32;font-weight:bold;}'
                        . '.btn{display:inline-block;background:#2e7d32;color:#fff !important;padding:12px 25px;text-decoration:none;border-radius:50px;font-weight:bold;margin-top:20px;}'
                        . '</style></head><body>'
                        . '<div class="container">'
                        . '<div class="header"><h1>QUINTA DA ESCOLA</h1></div>'
                        . '<div class="content">'
                        . '<h2 style="color:#333;margin-top:0;">Olá, ' . htmlspecialchars($nomeEE) . '!</h2>'
                        . '<p>Ficamos muito contentes de ter escolhido a Quinta da Escola para mais umas férias fantásticas!</p>'
                        . '<p>A inscrição está confirmada e agora pode avançar para a próxima fase.</p>'
                        . '<p>O pagamento deverá ser efetuado e o respetivo comprovativo enviado para <strong>info@quintadaescola.com</strong> com o nome do participante.</p>'
                        . '<p><strong>IBAN:</strong> PT50 0045 5242 4038 3330 5293 2</p>'
                        . '<p>Mais perto da data enviaremos o resto das informações para que nada falte nesta aventura.</p>'
                        . '<div class="info-box">'
                        . '<div class="info-item"><span class="label">Turno:</span> ' . htmlspecialchars($turno) . '</div>'
                        . '<div class="info-item"><span class="label">Valor Total:</span> <span class="value">' . htmlspecialchars($valor) . '&euro;</span></div>'
                        . '</div>'
                        . '<center><a href="mailto:info@quintadaescola.com" class="btn">Enviar Comprovativo</a></center>'
                        . '</div></div></body></html>';

                    $mail->setFrom('info@quintadaescola.com', 'Quinta da Escola');
                    $mail->addAddress($emailEE, $nomeEE);
                    $mail->addReplyTo('info@quintadaescola.com', 'Quinta da Escola');

                    $mail->Subject = $assuntoEE;
                    $mail->Body    = $htmlEE;
                    $mail->send();
                }
            } catch (\Throwable $e) {
                error_log("Erro ao enviar email de nova inscrição via PHPMailer: " . $e->getMessage());
            }
            
            echo json_encode(["id" => $novaInscricaoId]);

        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['erro' => 'Erro na Inserção', 'detalhe' => $e->getMessage()]);
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
                $camposPart = [];
                $valoresPart = [];

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
                if (array_key_exists('numeroBeneficiario', $dados)) { $campos[] = "numero_beneficiario = ?"; $valores[] = $dados['numeroBeneficiario']; }
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
                        if (isset($dados['participante']['nomeCompleto'])) { $camposPart[] = "nome_completo = ?"; $valoresPart[] = $dados['participante']['nomeCompleto']; }
                        if (isset($dados['participante']['genero'])) { $camposPart[] = "genero = ?"; $valoresPart[] = $dados['participante']['genero']; }
                        if (isset($dados['participante']['nif'])) { $camposPart[] = "nif = ?"; $valoresPart[] = $dados['participante']['nif']; }
                        if (isset($dados['participante']['cc'])) { $camposPart[] = "cc = ?"; $valoresPart[] = $dados['participante']['cc']; }
                        if (isset($dados['participante']['codigoPostal'])) { $camposPart[] = "morada = ?"; $valoresPart[] = $dados['participante']['codigoPostal']; }
                        if (isset($dados['participante']['sistemaSaude'])) { $camposPart[] = "sistema_saude = ?"; $valoresPart[] = $dados['participante']['sistemaSaude']; }
                        if (isset($dados['participante']['dataNascimento'])) { $camposPart[] = "data_nascimento = ?"; $valoresPart[] = $dados['participante']['dataNascimento']; }

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

                if (!empty($campos) || !empty($camposPart)) {
                    $stmtInfo = $pdo->prepare("
                        SELECT p.nome_completo, p.email_ee 
                        FROM inscricoes i 
                        JOIN participantes p ON i.participante_id = p.id 
                        WHERE i.id = ?
                    ");
                    $stmtInfo->execute([$id]);
                    $registo = $stmtInfo->fetch();
                    
                    $alvoNome = $registo ? $registo['nome_completo'] : 'Desconhecido';
                    $alvoEmail = $registo ? $registo['email_ee'] : 'Desconhecido';

                    $camposAlterados = array_merge(
                        array_map(function($c) { return explode(' =', $c)[0]; }, $campos ?? []),
                        array_map(function($c) { return explode(' =', $c)[0]; }, $camposPart ?? [])
                    );
                    
                    registar_log($pdo, $atorAtivo, 'UPDATE', 'inscricao', $alvoNome, $alvoEmail, ['alterou' => $camposAlterados]);
                }
            }
            $pdo->commit();
            echo json_encode(["msg" => "OK"]);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['erro' => 'Erro interno na atualização batch.', 'detalhe' => $e->getMessage()]);
        }
        exit;
    }
    
    // Configurações
    if ($acao === 'salvar_config_turnos') {
        if (!$adminUser) { http_response_code(403); exit; }
        $stmt = $pdo->prepare("REPLACE INTO configuracoes (chave, valor) VALUES ('turnos', ?)");
        $stmt->execute([json_encode($input)]);
        registar_log($pdo, $atorAtivo, 'UPDATE', 'configuracoes', 'Turnos', null, ['detalhe' => 'Turnos atualizados']);
        echo json_encode(["msg" => "OK"]);
        exit;
    }
    
    // Delete
    if ($acao === 'apagar') {
        if (!$adminUser) { http_response_code(403); exit; }
        $id = $input['id'] ?? null;
        if ($id) {
            $stmtInfo = $pdo->prepare("SELECT p.nome_completo, p.email_ee FROM inscricoes i JOIN participantes p ON i.participante_id = p.id WHERE i.id = ?");
            $stmtInfo->execute([$id]);
            $registo = $stmtInfo->fetch();
            $alvoNome = $registo ? $registo['nome_completo'] : 'Desconhecido';
            $alvoEmail = $registo ? $registo['email_ee'] : 'Desconhecido';

            $stmt = $pdo->prepare("DELETE FROM inscricoes WHERE id = ?");
            $stmt->execute([$id]);
            registar_log($pdo, $atorAtivo, 'DELETE', 'inscricao', $alvoNome, $alvoEmail);
            echo json_encode(["msg" => "Apagado"]);
        }
        exit;
    }

    // C. Reenviar Email de Confirmação
    if ($acao === 'reenviar_email') {
        if (!$adminUser) { http_response_code(403); echo json_encode(['erro' => 'Não autorizado']); exit; }

        $para = $input['ee']['email']; 
        $bcc = 'info@quintadaescola.com'; 
        $assunto = 'Confirmação de Inscrição: ' . $input['participante']['nomeCompleto'] . ' - ' . $input['turnoEscolhido'];

        $mensagem = "
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            h2 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 5px; border-bottom: 1px solid #ddd; }
            .info-block { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #ddd; }
          </style>
        </head>
        <body>
            <h1>Resumo de Inscrição 📋</h1>
            <p>Olá <strong>{$input['ee']['nome']}</strong>, enviamos os dados da inscrição de <strong>{$input['participante']['nomeCompleto']}</strong>.</p>
            <div class='info-block'>
                <h2>Detalhes</h2>
                <p><strong>Turno:</strong> {$input['turnoEscolhido']}</p>
                <p><strong>Local:</strong> {$input['local']}</p>
                <p><strong>Valor Total:</strong> {$input['valor_total']}€</p>
                <p><strong>Estado Pagamento:</strong> " . strtoupper($input['estado_pagamento']) . "</p>
            </div>
            <p>Qualquer dúvida, podes responder diretamente a este email.</p>
        </body>
        </html>
        ";

        $mail = new PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->Host       = 'mail.quintadaescola.com'; 
            $mail->SMTPAuth   = true;
            $mail->Username   = 'noreply@quintadaescola.com';
            $mail->Password   = 'hS99W+EanZwGHBIL';        
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port       = 465;
            $mail->CharSet    = 'UTF-8';
            
            $mail->setFrom('info@quintadaescola.com', 'Quinta da Escola');
            $mail->addAddress($para, $input['ee']['nome']);
            $mail->addBCC($bcc); 

            $mail->isHTML(true);
            $mail->Subject = $assunto;
            $mail->Body    = $mensagem;

            $mail->send();
            registar_log($pdo, $atorAtivo, 'EMAIL_SENT', 'inscricao', $input['participante']['nomeCompleto'], $para, ['assunto' => 'Reenvio Confirmação']);
            
            echo json_encode(["msg" => "Email reenviado com sucesso"]);
        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode(["erro" => "Falha ao enviar o email através do servidor: " . $e->getMessage()]);
        }
        exit;
    }
}