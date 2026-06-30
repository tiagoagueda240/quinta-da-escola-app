<?php
// api/auth.php
require 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['erro' => 'Método não suportado.'], 405);
}

$input    = json_decode(file_get_contents('php://input'), true) ?? [];
$email    = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
    json_response(['erro' => 'Credenciais inválidas.'], 400);
}

// CORREÇÃO: Removido o 'nome' da pesquisa
$stmt = $pdo->prepare("SELECT id, email, password_hash, role FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_response(['erro' => 'Email ou password incorretos.'], 401);
}

// CORREÇÃO: Removido o 'nome' da geração do Token
$jwt = generate_jwt([
    'id'    => $user['id'],
    'email' => $user['email'],
    'role'  => $user['role'],
    'exp'   => time() + 86400, // 24 horas
]);

// CORREÇÃO: Removido o 'nome' da resposta enviada ao Angular
json_response([
    'token' => $jwt,
    'user'  => [
        'email' => $user['email'],
        'role'  => $user['role'],
    ],
]);