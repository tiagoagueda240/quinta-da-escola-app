<?php
// send-email.php — Envio via SMTP direto (SSL, porta 465)
require_once __DIR__ . '/api/secrets.php';
require_once __DIR__ . '/api/smtp.php';

function logMsg($msg) {
    $date = date('Y-m-d H:i:s');
    // Rotate log: keep only last 90 days. Delete if older.
    $logFile = __DIR__ . '/log.txt';
    if (file_exists($logFile) && (time() - filemtime($logFile)) > 90 * 86400) {
        unlink($logFile);
    }
    file_put_contents($logFile, "[$date] $msg" . PHP_EOL, FILE_APPEND);
}

// Anonymize email for logging (show only domain, e.g. ***@gmail.com)
function anonimizarEmail($email) {
    $parts = explode('@', $email);
    if (count($parts) !== 2) return '***@***.***';
    return '***@' . $parts[1];
}

// CORS
header("Access-Control-Allow-Origin: https://turnos.quintadaescola.com");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$rawInput = file_get_contents('php://input');
$input    = json_decode($rawInput, true);

if (!$input || empty($input['email'])) {
    logMsg("ERRO: Dados em falta.");
    http_response_code(400);
    echo json_encode(["error" => "Dados em falta"]);
    exit;
}

$para  = filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL);
$nome  = htmlspecialchars(trim($input['nome']  ?? 'Encarregado de Educacao'), ENT_QUOTES, 'UTF-8');
$turno = htmlspecialchars(trim($input['turno'] ?? ''), ENT_QUOTES, 'UTF-8');
$valor = htmlspecialchars(trim((string)($input['valor'] ?? '')), ENT_QUOTES, 'UTF-8');

if (!$para) {
    logMsg("ERRO: Email invalido: " . $input['email']);
    http_response_code(400);
    echo json_encode(["error" => "Email invalido"]);
    exit;
}

logMsg("A enviar para: " . anonimizarEmail($para) . " | turno: $turno | valor: $valor");

$html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
    . 'body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f8;}'
    . '.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;}'
    . '.header{background:#2e7d32;padding:30px 20px;text-align:center;}'
    . '.header h1{color:#fff;margin:0;font-size:24px;}'
    . '.content{padding:40px 30px;color:#333;line-height:1.7;}'
    . '.info-box{background:#f1f8e9;border-left:5px solid #2e7d32;padding:20px;margin:20px 0;border-radius:4px;}'
    . '.label{font-weight:bold;color:#555;}'
    . '.value{color:#2e7d32;font-weight:bold;}'
    . '.btn{display:inline-block;background:#2e7d32;color:#fff !important;padding:12px 25px;text-decoration:none;border-radius:50px;font-weight:bold;margin-top:20px;}'
    . '</style></head><body>'
    . '<div class="container">'
    . '<div class="header"><h1>QUINTA DA ESCOLA</h1></div>'
    . '<div class="content">'
    . '<h2 style="color:#333;margin-top:0;">Ola, ' . $nome . '!</h2>'
    . '<p>Ficamos muito contentes de ter escolhido a Quinta da Escola para mais umas ferias fantasticas!</p>'
    . '<p>A inscricao esta confirmada e agora pode avancar para a proxima fase.</p>'
    . '<p>O pagamento devera ser efetuado e o respetivo comprovativo enviado para <strong>info@quintadaescola.com</strong>.</p>'
    . '<p><strong>NIB:</strong> PT50 0045 5242 4038 3330 5293 2</p>'
    . '<p>Mais perto da data enviaremos o resto das informacoes para que nada falte nesta aventura.</p>'
    . '<div class="info-box">'
    . '<div class="info-item"><span class="label">Turno:</span> ' . $turno . '</div>'
    . '<div class="info-item"><span class="label">Valor Total:</span> <span class="value">' . $valor . '&euro;</span></div>'
    . '</div>'
    . '<center><a href="mailto:info@quintadaescola.com" class="btn">Enviar Comprovativo</a></center>'
    . '</div></div></body></html>';

$resultado = enviarSmtp($para, 'Confirmacao de Inscricao - Quinta da Escola', $html);

if ($resultado === true) {
    logMsg("Email enviado com sucesso para: " . anonimizarEmail($para));
    echo json_encode(["success" => true]);
} else {
    logMsg("ERRO ao enviar para " . anonimizarEmail($para) . ": $resultado");
    http_response_code(500);
    echo json_encode(["error" => $resultado]);
}