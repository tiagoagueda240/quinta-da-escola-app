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

try {
    $stmt = $pdo->prepare("SELECT id, email, password_hash, role FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
} catch (PDOException $e) {
    error_log('auth.php DB error: ' . $e->getMessage());
    json_response(['erro' => 'Erro interno do servidor.'], 500);
}

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_response(['erro' => 'Email ou password incorretos.'], 401);
}

$jwt = generate_jwt([
    'id'    => $user['id'],
    'email' => $user['email'],
    'role'  => $user['role'],
    'nome'  => $user['email'],
    'exp'   => time() + 86400, // 24 horas
]);

json_response([
    'token' => $jwt,
    'user'  => [
        'email' => $user['email'],
        'nome'  => $user['email'],
        'role'  => $user['role'],
    ],
]);
