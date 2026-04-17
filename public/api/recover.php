<?php
// api/recover.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

// --- 1. PEDIR RECUPERAÇÃO (Gera Token e Envia Email) ---
if ($method === 'POST') {
    $email = $input['email'] ?? '';

    // Verificar se o email existe
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if (!$stmt->fetch()) {
        // Por segurança, respondemos sucesso mesmo se o email não existir (para não revelar users)
        echo json_encode(["msg" => "Se o email existir, receberá instruções."]);
        exit;
    }

    // Gerar Token Seguro
    $token = bin2hex(random_bytes(32)); // Token de 64 caracteres
    $expires = date('Y-m-d H:i:s', strtotime('+1 hour')); // Válido por 1 hora

    // Guardar na BD
    $sql = "UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$token, $expires, $email]);

    // Enviar Email (Simples)
    // NOTA: Em produção, usa PHPMailer com SMTP para não ir para SPAM.
    // Aqui usamos a função mail() nativa do PHP.
    $link = "https://turnos.quintadaescola.com/reset-password?token=" . $token;
    
    $assunto = "Recuperar Password - Quinta da Escola";
    $mensagem = "Olá,\n\nRecebemos um pedido para alterar a tua senha.\n";
    $mensagem .= "Clica no link abaixo para definir uma nova senha:\n\n";
    $mensagem .= $link . "\n\n";
    $mensagem .= "Este link expira em 1 hora.\nSe não foste tu, ignora este email.";
    
    $headers = "From: noreply@quintadaescola.com";

    // Tenta enviar
    mail($email, $assunto, $mensagem, $headers);

    echo json_encode(["msg" => "Email enviado."]);
}

// --- 2. DEFINIR NOVA SENHA (Valida Token e Altera) ---
if ($method === 'PUT') {
    $token = $input['token'] ?? '';
    $novaPass = $input['password'] ?? '';

    if (!$token || !$novaPass) {
        http_response_code(400); echo json_encode(["erro" => "Dados incompletos."]); exit;
    }

    // Verificar Token Válido e Não Expirado
    $sql = "SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(400); echo json_encode(["erro" => "Link inválido ou expirado."]); exit;
    }

    // Atualizar Password e Limpar Token
    $hash = password_hash($novaPass, PASSWORD_DEFAULT);
    
    $update = $pdo->prepare("UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?");
    $update->execute([$hash, $user['id']]);

    echo json_encode(["msg" => "Senha alterada com sucesso!"]);
}
?>