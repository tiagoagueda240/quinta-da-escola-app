<?php
// api/monitores.php
require 'config.php';

// ===================================================================================
// 0. SEGURANÇA E AUTENTICAÇÃO
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

// ===================================================================================
// 1. GET (LEITURA) - Permitido a Ambos (Admin e Coord)
// ===================================================================================
if ($method === 'GET') {

    if (isset($_GET['nomes'])) {
        $listaNomes = explode(',', $_GET['nomes']);
        $listaNomes = array_map('trim', $listaNomes); 
        $listaNomes = array_filter($listaNomes); 

        if (empty($listaNomes)) {
            echo json_encode([]);
            exit;
        }

        $placeholders = str_repeat('?,', count($listaNomes) - 1) . '?';

        $sql = "SELECT nome, nomeMonitor, telefone FROM monitores WHERE nome IN ($placeholders) OR nomeMonitor IN ($placeholders)";
        $stmt = $pdo->prepare($sql);

        $params = array_merge($listaNomes, $listaNomes);
        $stmt->execute($params);

        echo json_encode($stmt->fetchAll());
        exit;
    }

    $termo = $_GET['q'] ?? '';
    $sql = "SELECT * FROM monitores WHERE 1=1";
    $params = [];

    if ($termo) {
        $sql .= " AND (nome LIKE ? OR nomeMonitor LIKE ? OR email LIKE ?)";
        $termo = "%$termo%";
        $params = [$termo, $termo, $termo];
    }

    $sql .= " ORDER BY nome ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $result = $stmt->fetchAll();

    foreach ($result as &$row) {
        $row['turnosAtribuidos'] = json_decode($row['turnosAtribuidos']) ?? [];
        $row['formacoes'] = json_decode($row['formacoes']) ?? [];
    }
    echo json_encode($result);
    exit;
}

// ===================================================================================
// BLOQUEIO DE ESCRITA: APENAS ADMIN PODE EDITAR MONITORES
// ===================================================================================
if (!$adminUser) {
    http_response_code(403);
    echo json_encode(["erro" => "Acesso negado. Apenas administradores podem gerir monitores."]);
    exit;
}

// --- POST: Criar Um ou Vários (Importação Excel) ---
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $lista = isset($input[0]) ? $input : [$input];
    $pdo->beginTransaction();

    try {
        $sql = "INSERT INTO monitores (nome, nomeMonitor, email, telefone, turnosAtribuidos, formacoes, status, obs, diasTrabalhados, intolerancias) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                nome=VALUES(nome), 
                nomeMonitor=VALUES(nomeMonitor), 
                telefone=VALUES(telefone), 
                formacoes=VALUES(formacoes),
                status=VALUES(status),
                obs=VALUES(obs),
                diasTrabalhados=VALUES(diasTrabalhados),
                intolerancias=VALUES(intolerancias)"; 

        $stmt = $pdo->prepare($sql);

        foreach ($lista as $m) {
            if (empty($m['nome']) && empty($m['email'])) continue;

            $stmt->execute([
                $m['nome'],
                $m['nomeMonitor'] ?? '',
                $m['email'] ?? null, 
                $m['telefone'] ?? '',
                json_encode($m['turnosAtribuidos'] ?? []),
                json_encode($m['formacoes'] ?? []),
                $m['status'] ?? 'monitor',
                $m['obs'] ?? '',
                $m['diasTrabalhados'] ?? 0,
                $m['intolerancias'] ?? ''
            ]);
        }
        $pdo->commit();
        
        $alvoNome = count($lista) === 1 ? $lista[0]['nome'] : count($lista) . ' Monitores';
        $alvoEmail = count($lista) === 1 ? ($lista[0]['email'] ?? 'Sem email') : 'Vários Emails';
        registar_log($pdo, $atorAtivo, 'UPSERT', 'monitor', $alvoNome, $alvoEmail);
        
        echo json_encode(["msg" => "Sucesso", "total" => count($lista)]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["erro" => $e->getMessage()]);
    }
    exit;
}

// --- PUT: Atualizar um registo específico ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        http_response_code(400); echo json_encode(['erro' => 'ID obrigatório.']); exit;
    }

    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    if (isset($data['turnosAtribuidos'])) { $data['turnosAtribuidos'] = json_encode($data['turnosAtribuidos']); }
    if (isset($data['formacoes'])) { $data['formacoes'] = json_encode($data['formacoes']); }

    $allowed = ['nome', 'nomeMonitor', 'email', 'telefone', 'status', 'obs', 'diasTrabalhados', 'intolerancias', 'turnosAtribuidos', 'formacoes'];
    $fields = [];
    $values = [];
    
    foreach ($data as $key => $val) {
        if (in_array($key, $allowed, true)) {
            $fields[] = "`$key` = ?";
            $values[] = $val;
        }
    }

    if (empty($fields)) {
        http_response_code(400); echo json_encode(['erro' => 'Nenhum campo válido para atualizar.']); exit;
    }

    $stmtInfo = $pdo->prepare("SELECT nome, email FROM monitores WHERE id = ?");
    $stmtInfo->execute([$id]);
    $registo = $stmtInfo->fetch();

    $alvoNome = $registo ? $registo['nome'] : 'Desconhecido';
    $alvoEmail = $registo ? $registo['email'] : 'Desconhecido';

    $values[] = $id;
    $stmt = $pdo->prepare("UPDATE monitores SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($values);
    
    registar_log($pdo, $atorAtivo, 'UPDATE', 'monitor', $alvoNome, $alvoEmail, ['alterou' => array_keys($data)]);
    
    echo json_encode(['msg' => 'Atualizado com sucesso']);
    exit;
}

// --- DELETE: Apagar ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        http_response_code(400); echo json_encode(['erro' => 'ID obrigatório.']); exit;
    }

    $stmtInfo = $pdo->prepare("SELECT nome, email FROM monitores WHERE id = ?");
    $stmtInfo->execute([$id]);
    $registo = $stmtInfo->fetch();
    
    $alvoNome = $registo ? $registo['nome'] : 'Desconhecido';
    $alvoEmail = $registo ? $registo['email'] : 'Desconhecido';

    $stmt = $pdo->prepare("DELETE FROM monitores WHERE id = ?");
    $stmt->execute([$id]);
    
    if ($stmt->rowCount() === 0) {
        http_response_code(404); echo json_encode(['erro' => 'Monitor não encontrado.']); exit;
    }
    
    registar_log($pdo, $atorAtivo, 'DELETE', 'monitor', $alvoNome, $alvoEmail);
    
    echo json_encode(['msg' => 'Apagado com sucesso']);
    exit;
}