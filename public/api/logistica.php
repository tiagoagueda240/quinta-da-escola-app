<?php
// api/logistica.php
require 'config.php';

// ===================================================================================
// 0. SEGURANÇA E AUTENTICAÇÃO (Suporta Admin e Coordenador)
// ===================================================================================
$adminUser = null;
$tokenData = null;

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

$authHeader = get_auth_header();

if ($authHeader) {
    $adminUser = verificarAuth();
} elseif (isset($_GET['token'])) {
    $token = $_GET['token'];
    $stmt = $pdo->prepare("SELECT * FROM access_tokens WHERE token = ? AND expira_em > NOW()");
    $stmt->execute([$token]);
    $tokenData = $stmt->fetch();

    if (!$tokenData) {
        http_response_code(403); echo json_encode(["erro" => "Link inválido ou expirado"]); exit();
    }

    $pinEnviado = '';
    if (function_exists('getallheaders')) {
        $h = getallheaders();
        $pinEnviado = $h['X-Access-Pin'] ?? $h['x-access-pin'] ?? '';
    } else {
        $pinEnviado = $_SERVER['HTTP_X_ACCESS_PIN'] ?? '';
    }

    if (!password_verify($pinEnviado, $tokenData['pin_hash'])) {
        http_response_code(401); echo json_encode(["erro" => "PIN incorreto"]); exit();
    }
} else {
    http_response_code(401); echo json_encode(["erro" => "Não autorizado"]); exit();
}

$atorAtivo = $adminUser ? $adminUser['email'] : ($tokenData['nome_coordenador'] . ' (Coord)');
$method = $_SERVER['REQUEST_METHOD'];
$acao = $_GET['acao'] ?? ''; 

// ===================================================================================
// 1. GET (LEITURA)
// ===================================================================================

// --- GET (Template): Ler o Layout Visual ---
if ($method === 'GET' && $acao === 'template') {
    $local = $_GET['local'] ?? 'quinta';
    
    $stmt = $pdo->prepare("SELECT estrutura_json FROM layout_templates WHERE local_key = ?");
    $stmt->execute([$local]);
    $res = $stmt->fetch();
    
    if ($res) {
        header('Content-Type: application/json');
        echo $res['estrutura_json'];
    } else {
        echo json_encode([]); 
    }
    exit;
}

// --- GET (Dados): Ler Quartos Gravados ---
if ($method === 'GET' && $acao === '') {
    $turno = $_GET['turno'] ?? '';
    $local = $_GET['local'] ?? '';
    
    $mapaLocais = ['quinta' => 'Quinta', 'costaCaparica' => 'Costa da Caparica', 'quiaios' => 'Quiaios'];
    $localSql = $mapaLocais[$local] ?? 'Quinta';

    $stmt = $pdo->prepare("SELECT * FROM logistica_turnos WHERE turno = ? AND local = ?");
    $stmt->execute([$turno, $localSql]);
    echo json_encode($stmt->fetchAll());
    exit;
}

// ===================================================================================
// 2. POST (GRAVAÇÃO)
// ===================================================================================

// --- POST: Gravar Estrutura (Cria, Atualiza e Apaga) ---
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $turno = $input['turno'];
    $localKey = $input['local'];
    
    $mapaLocais = ['quinta' => 'Quinta', 'costaCaparica' => 'Costa da Caparica', 'quiaios' => 'Quiaios'];
    $localSql = $mapaLocais[$localKey] ?? 'Quinta';

    // VERIFICAÇÃO DE SEGURANÇA PARA COORDENADORES
    if ($tokenData) {
        $localPermitido = $mapaLocais[$tokenData['local']] ?? 'Quinta';
        $turnosPermitidos = json_decode($tokenData['turnos_permitidos'], true) ?? [];
        
        if ($localSql !== $localPermitido || !in_array($turno, $turnosPermitidos)) {
            http_response_code(403);
            echo json_encode(["erro" => "Não tens permissões para alterar a logística deste turno."]);
            exit;
        }
    }
    
    $items = $input['items']; 

    $pdo->beginTransaction();
    try {
        $idsMap = [];     
        $activeIds = [];  

        // 1. PROCESSAR ITENS (UPSERT)
        foreach ($items as $item) {
            $dbId = $item['dbId'] ?? null; 

            $titulo = $item['titulo'];
            $monitor = $item['monitor'];
            $capacidade = $item['capacidade'];
            $genero = $item['genero'] ?? 'Misto';
            $tipo = $item['tipo']; 

            if ($dbId) {
                // UPDATE
                $stmt = $pdo->prepare("UPDATE logistica_turnos SET titulo=?, monitor_nome=?, capacidade=?, genero=? WHERE id=?");
                $stmt->execute([$titulo, $monitor, $capacidade, $genero, $dbId]);
                
                $idsMap[$item['id']] = $dbId;
                $activeIds[] = $dbId; 
            } else {
                // INSERT
                $checkStmt = $pdo->prepare("SELECT id FROM logistica_turnos WHERE turno=? AND local=? AND tipo=? AND titulo=?");
                $checkStmt->execute([$turno, $localSql, $tipo, $titulo]);
                $existing = $checkStmt->fetch();

                if ($existing) {
                    $realId = $existing['id'];
                    $stmt = $pdo->prepare("UPDATE logistica_turnos SET monitor_nome=?, capacidade=?, genero=? WHERE id=?");
                    $stmt->execute([$monitor, $capacidade, $genero, $realId]);
                    
                    $idsMap[$item['id']] = $realId;
                    $activeIds[] = $realId;
                } else {
                    $stmt = $pdo->prepare("INSERT INTO logistica_turnos (turno, local, tipo, titulo, monitor_nome, capacidade, genero) VALUES (?, ?, ?, ?, ?, ?, ?)");
                    $stmt->execute([$turno, $localSql, $tipo, $titulo, $monitor, $capacidade, $genero]);
                    
                    $newId = $pdo->lastInsertId();
                    $idsMap[$item['id']] = $newId;
                    $activeIds[] = $newId;
                }
            }
        }

        // 2. LIMPEZA (DELETE)
        if (!empty($activeIds)) {
            $placeholders = implode(',', array_fill(0, count($activeIds), '?'));
            $sqlDelete = "DELETE FROM logistica_turnos WHERE turno = ? AND local = ? AND id NOT IN ($placeholders)";
            $params = array_merge([$turno, $localSql], $activeIds);
            
            $stmtDel = $pdo->prepare($sqlDelete);
            $stmtDel->execute($params);
        } else {
            $stmtDel = $pdo->prepare("DELETE FROM logistica_turnos WHERE turno = ? AND local = ?");
            $stmtDel->execute([$turno, $localSql]);
        }
        
        $pdo->commit();

        registar_log($pdo, $atorAtivo, 'UPDATE', 'logistica', "Turno: $turno", "Local: $localKey", ['quartos_afetados' => count($idsMap)]);

        echo json_encode(["msg" => "Estrutura sincronizada (Upsert + Clean)", "ids" => $idsMap]);

    } catch (Exception $e) {
        $pdo->rollBack();
        $msg = $is_dev_request ? $e->getMessage() : 'Erro interno ao guardar estrutura.';
        http_response_code(500);
        echo json_encode(['erro' => $msg]);
    }
    exit;
}