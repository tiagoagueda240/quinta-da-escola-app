<?php
// api/logistica.php
require 'config.php';

// --- Verificação de Segurança (Admin) ---
$adminUser = null;
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

if ($authHeader) {
    $adminUser = verificarAuth();
} else {
    http_response_code(401);
    echo json_encode(["erro" => "Não autorizado"]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$acao = $_GET['acao'] ?? ''; // Captura ação se existir

// --- GET (Template): Ler o Layout Visual ---
if ($method === 'GET' && $acao === 'template') {
    $local = $_GET['local'] ?? 'quinta';
    
    // Mapeia frontend keys para keys da DB se necessário, ou usa direto
    // No SQL inserimos 'quinta', 'costaCaparica', 'quiaios' igual ao frontend
    
    $stmt = $pdo->prepare("SELECT estrutura_json FROM layout_templates WHERE local_key = ?");
    $stmt->execute([$local]);
    $res = $stmt->fetch();
    
    if ($res) {
        // Envia o JSON puro que está na coluna
        header('Content-Type: application/json');
        echo $res['estrutura_json'];
    } else {
        echo json_encode([]); // Retorna vazio se não houver template
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

// --- POST: Gravar Estrutura (Cria, Atualiza e Apaga) ---
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $turno = $input['turno'];
    $localKey = $input['local'];
    
    $mapaLocais = ['quinta' => 'Quinta', 'costaCaparica' => 'Costa da Caparica', 'quiaios' => 'Quiaios'];
    $localSql = $mapaLocais[$localKey] ?? 'Quinta';
    
    $items = $input['items']; // Lista de quartos/grupos ativos no frontend

    $pdo->beginTransaction();
    try {
        $idsMap = [];     // { "temp-id": 15 }
        $activeIds = [];  // Lista de IDs reais que devem ser mantidos na BD

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
                $activeIds[] = $dbId; // Marca este ID como "ativo"
            } else {
                // INSERT (Verificar duplicado primeiro)
                $checkStmt = $pdo->prepare("SELECT id FROM logistica_turnos WHERE turno=? AND local=? AND tipo=? AND titulo=?");
                $checkStmt->execute([$turno, $localSql, $tipo, $titulo]);
                $existing = $checkStmt->fetch();

                if ($existing) {
                    // Já existe -> Update
                    $realId = $existing['id'];
                    $stmt = $pdo->prepare("UPDATE logistica_turnos SET monitor_nome=?, capacidade=?, genero=? WHERE id=?");
                    $stmt->execute([$monitor, $capacidade, $genero, $realId]);
                    
                    $idsMap[$item['id']] = $realId;
                    $activeIds[] = $realId;
                } else {
                    // Não existe -> Insert
                    $stmt = $pdo->prepare("INSERT INTO logistica_turnos (turno, local, tipo, titulo, monitor_nome, capacidade, genero) VALUES (?, ?, ?, ?, ?, ?, ?)");
                    $stmt->execute([$turno, $localSql, $tipo, $titulo, $monitor, $capacidade, $genero]);
                    
                    $newId = $pdo->lastInsertId();
                    $idsMap[$item['id']] = $newId;
                    $activeIds[] = $newId;
                }
            }
        }

        // 2. LIMPEZA (DELETE)
        // Apaga tudo o que é deste turno/local mas NÃO está na lista $activeIds
        if (!empty($activeIds)) {
            // Cria string de placeholders (?,?,?)
            $placeholders = implode(',', array_fill(0, count($activeIds), '?'));
            
            // Query: Delete WHERE turno=X AND local=Y AND id NOT IN (1, 2, 3...)
            $sqlDelete = "DELETE FROM logistica_turnos WHERE turno = ? AND local = ? AND id NOT IN ($placeholders)";
            
            // Merge dos parâmetros: Turno, Local, ...IDs
            $params = array_merge([$turno, $localSql], $activeIds);
            
            $stmtDel = $pdo->prepare($sqlDelete);
            $stmtDel->execute($params);
        } else {
            // Se a lista de itens veio vazia, significa que o utilizador apagou tudo.
            // Apagamos todos os registos deste turno/local.
            $stmtDel = $pdo->prepare("DELETE FROM logistica_turnos WHERE turno = ? AND local = ?");
            $stmtDel->execute([$turno, $localSql]);
        }
        
        $pdo->commit();
        echo json_encode(["msg" => "Estrutura sincronizada (Upsert + Clean)", "ids" => $idsMap]);

    } catch (Exception $e) {
        $pdo->rollBack();
        $msg = $is_dev_request ? $e->getMessage() : 'Erro interno ao guardar estrutura.';
        json_response(['erro' => $msg], 500);
    }
    exit;
}
?>