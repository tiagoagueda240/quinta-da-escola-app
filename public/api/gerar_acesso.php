<?php
// api/gerar_acesso.php
require 'config.php';

$user = verificarAuth();
if (!$user || $user['role'] !== 'admin') { http_response_code(403); exit; }

$input = json_decode(file_get_contents('php://input'), true);

// ... (Ler nome, local, turnos como antes) ...

// --- NOVO: Tratamento do PIN ---
$pin = $input['pin']; // Ex: "1234"
if (!$pin || strlen($pin) < 4) {
    http_response_code(400); echo json_encode(["erro" => "PIN deve ter 4 dígitos"]); exit;
}
$pinHash = password_hash($pin, PASSWORD_DEFAULT);
// ------------------------------

$token = bin2hex(random_bytes(32));
$expira = date('Y-m-d H:i:s', strtotime("+30 days")); // Exemplo

// Gravar com o PIN Hash
$stmt = $pdo->prepare("INSERT INTO access_tokens (token, nome_coordenador, local, turnos_permitidos, expira_em, pin_hash) VALUES (?, ?, ?, ?, ?, ?)");
$stmt->execute([$token, $input['nome'], $input['local'], json_encode($input['turnos']), $expira, $pinHash]);

echo json_encode([
    "msg" => "Acesso Criado!",
    "link" => "https://turnos.quintadaescola.com/checkin?token=" . $token,
    "pin_lembrete" => $pin // Devolvemos só para confirmar
]);
?>