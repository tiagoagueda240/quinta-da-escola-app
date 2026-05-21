<?php
// teste_smtp.php — Testa o envio SMTP direto (mesmo mecanismo do send-email.php)
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once __DIR__ . '/api/secrets.php';
require_once __DIR__ . '/api/smtp.php';

echo "<h1>Teste SMTP Direto</h1>";
echo "<p>Servidor: <strong>" . SMTP_HOST . ":" . SMTP_PORT . "</strong></p>";
echo "<p>Remetente: <strong>" . SMTP_USER . "</strong></p>";

$destinatario = 'agueda.tap@gmail.com';
echo "<p>Destinatário: <strong>$destinatario</strong></p>";

$resultado = enviarSmtp(
    $destinatario,
    'Teste SMTP – Quinta da Escola',
    '<h2>Teste bem sucedido!</h2><p>O SMTP direto está a funcionar corretamente.</p>'
);

if ($resultado === true) {
    echo "<h2 style='color:green'>✅ Email enviado com sucesso!</h2>";
} else {
    echo "<h2 style='color:red'>❌ Erro: " . htmlspecialchars($resultado) . "</h2>";
}
?>
