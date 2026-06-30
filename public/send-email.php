<?php
// send-email.php — Envio via mail() nativo do servidor (sem API externa)

function logMsg($msg) {
    $date = date('Y-m-d H:i:s');
    file_put_contents(__DIR__ . '/log.txt', "[$date] $msg" . PHP_EOL, FILE_APPEND);
}

// CORS
header("Access-Control-Allow-Origin: https://turnos.quintadaescola.com");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Receber dados do Angular
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!$input || empty($input['email'])) {
    logMsg("ERRO: Dados em falta. Raw: " . $rawInput);
    http_response_code(400);
    echo json_encode(["error" => "Dados em falta"]);
    exit;
}

$para      = filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL);
$nome      = htmlspecialchars(trim($input['nome']  ?? 'Encarregado de Educacao'), ENT_QUOTES, 'UTF-8');
$turno     = htmlspecialchars(trim($input['turno'] ?? ''), ENT_QUOTES, 'UTF-8');
$valor     = htmlspecialchars(trim($input['valor'] ?? ''), ENT_QUOTES, 'UTF-8');

if (!$para) {
    logMsg("ERRO: Email invalido: " . $input['email']);
    http_response_code(400);
    echo json_encode(["error" => "Email invalido"]);
    exit;
}

logMsg("A enviar para: $para");

// Construir email HTML
$assunto   = '=?UTF-8?B?' . base64_encode('Confirmacao de Inscricao - Quinta da Escola') . '?=';
$remetente = 'Quinta da Escola <noreply@quintadaescola.com>';

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

$headers  = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
$headers .= "From: " . $remetente . "\r\n";
$headers .= "Reply-To: info@quintadaescola.com\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();

$enviado = mail($para, $assunto, $html, $headers);

if ($enviado) {
    logMsg("Email enviado com sucesso para: $para");
    echo json_encode(["success" => true]);
} else {
    logMsg("ERRO: mail() devolveu false para: $para");
    http_response_code(500);
    echo json_encode(["error" => "Falha ao enviar email."]);
}
?>
