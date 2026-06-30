<?php
// api/gerar_acesso.php
require 'config.php';

$user = verificarAuth();
if ($user['role'] !== 'admin') {
    json_response(['erro' => 'Acesso reservado a administradores.'], 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['erro' => 'Método não suportado.'], 405);
}

$input  = json_decode(file_get_contents('php://input'), true) ?? [];
$nome   = trim($input['nome']   ?? '');
$local  = trim($input['local']  ?? '');
$turnos = $input['turnos']      ?? [];
$pin    = $input['pin']         ?? '';

if (!$nome || !$local || empty($turnos)) {
    json_response(['erro' => 'Campos obrigatórios: nome, local, turnos.'], 400);
}

$locaisValidos = ['quinta', 'costaCaparica', 'quiaios'];
if (!in_array($local, $locaisValidos, true)) {
    json_response(['erro' => 'Local inválido.'], 400);
}

if (!$pin || strlen((string)$pin) < 4) {
    json_response(['erro' => 'PIN deve ter pelo menos 4 dígitos.'], 400);
}

$pinHash = password_hash((string)$pin, PASSWORD_DEFAULT);
$token   = bin2hex(random_bytes(32));
$expira  = date('Y-m-d H:i:s', strtotime('+30 days'));

$stmt = $pdo->prepare(
    "INSERT INTO access_tokens (token, nome_coordenador, local, turnos_permitidos, expira_em, pin_hash)
     VALUES (?, ?, ?, ?, ?, ?)"
);
$stmt->execute([$token, $nome, $local, json_encode($turnos), $expira, $pinHash]);

// REGISTO DE AUDITORIA: Geração de link temporário
registar_log($pdo, $user['email'], 'CREATE', 'acesso_coord', $nome, null, [
    'local' => $local,
    'turnos' => $turnos
]);

json_response([
    'msg'  => 'Acesso criado com sucesso.',
    'link' => 'https://turnos.quintadaescola.com/checkin?token=' . $token,
]);