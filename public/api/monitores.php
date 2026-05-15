<?php
// api/monitores.php
require 'config.php';

verificarAuth();

$method = $_SERVER['REQUEST_METHOD'];

// --- GET: Listar e Pesquisar ---
if ($method === 'GET') {

    // 1. NOVO: Buscar telemóveis por lista de nomes (Para o WhatsApp do Coordenador)
    if (isset($_GET['nomes'])) {
        $listaNomes = explode(',', $_GET['nomes']);
        $listaNomes = array_map('trim', $listaNomes); // Limpa espaços extras
        $listaNomes = array_filter($listaNomes); // Remove vazios

        if (empty($listaNomes)) {
            echo json_encode([]);
            exit;
        }

        // Cria os placeholders para o SQL (?,?,?) dependendo da quantidade de nomes
        $placeholders = str_repeat('?,', count($listaNomes) - 1) . '?';

        // Procura tanto no 'nome' (Nome Completo) como no 'nomeMonitor' (Alcunha)
        // Selecionamos apenas o necessário para o frontend
        $sql = "SELECT nome, nomeMonitor, telefone FROM monitores WHERE nome IN ($placeholders) OR nomeMonitor IN ($placeholders)";
        $stmt = $pdo->prepare($sql);

        // Precisamos de passar os valores 2 vezes (uma para WHERE nome IN, outra para OR nomeMonitor IN)
        $params = array_merge($listaNomes, $listaNomes);
        $stmt->execute($params);

        echo json_encode($stmt->fetchAll());
        exit;
    }

    // 2. Pesquisa Normal (Para a Tabela de Configuração e Lista Geral)
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

    // Converter Strings JSON para Arrays JS
    foreach ($result as &$row) {
        $row['turnosAtribuidos'] = json_decode($row['turnosAtribuidos']) ?? [];
        $row['formacoes'] = json_decode($row['formacoes']) ?? [];
    }
    echo json_encode($result);
}

// --- POST: Criar Um ou Vários (Importação Excel) ---
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Verifica se é um array (Batch) ou objeto (Single)
    $lista = isset($input[0]) ? $input : [$input];
    $pdo->beginTransaction();

    try {
        // QUERY MELHORADA: Atualiza todos os campos se encontrar duplicado (Upsert)
        // Nota: Requer que tenhas configurado UNIQUE(email) ou UNIQUE(nome) na BD
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
            // Validação simples para evitar linhas vazias
            if (empty($m['nome']) && empty($m['email'])) continue;

            $stmt->execute([
                $m['nome'],
                $m['nomeMonitor'] ?? '',
                $m['email'] ?? null, // Envia NULL se vazio para não dar erro de duplicado no UNIQUE
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
        echo json_encode(["msg" => "Sucesso", "total" => count($lista)]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["erro" => $e->getMessage()]);
    }
}

// --- PUT: Atualizar um registo específico ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        json_response(['erro' => 'ID obrigatório.'], 400);
    }

    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    // Converter arrays para JSON antes de gravar
    if (isset($data['turnosAtribuidos'])) {
        $data['turnosAtribuidos'] = json_encode($data['turnosAtribuidos']);
    }
    if (isset($data['formacoes'])) {
        $data['formacoes'] = json_encode($data['formacoes']);
    }

    // Whitelist de colunas permitidas (previne SQL injection por nomes de campos arbitrários)
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
        json_response(['erro' => 'Nenhum campo válido para atualizar.'], 400);
    }

    $values[] = $id;
    $stmt = $pdo->prepare("UPDATE monitores SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($values);
    json_response(['msg' => 'Atualizado com sucesso']);
}

// --- DELETE: Apagar ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        json_response(['erro' => 'ID obrigatório.'], 400);
    }
    $stmt = $pdo->prepare("DELETE FROM monitores WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        json_response(['erro' => 'Monitor não encontrado.'], 404);
    }
    json_response(['msg' => 'Apagado com sucesso']);
}
?>