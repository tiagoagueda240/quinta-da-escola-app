<?php
// api/auth.php
require 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

    // Procurar utilizador
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Verificar Password
    if ($user && password_verify($password, $user['password_hash'])) {
        
        // --- GERAR JWT (TOKEN) ---
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'nome' => $user['nome'],
            'exp' => time() + (60 * 60 * 24) // Expira em 24 horas
        ]);

        // Codificar Base64URL
        $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

        // Assinar
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $jwt_secret, true);
        $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

        $jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;

        echo json_encode([
            'token' => $jwt,
            'user' => [
                'email' => $user['email'],
                'nome' => $user['nome'],
                'role' => $user['role']
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['erro' => 'Email ou password incorretos.']);
    }
}
?>