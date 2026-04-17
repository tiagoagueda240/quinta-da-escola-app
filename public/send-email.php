<?php
// Ficheiro: public_html/api/send-email.php

// 1. Permissões (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Função para criar um registo de erros (Debug)
function logMsg($msg) {
    $date = date('Y-m-d H:i:s');
    file_put_contents('log.txt', "[$date] $msg" . PHP_EOL, FILE_APPEND);
}

// Responde OK ao pré-voo do Angular
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. Receber dados do Angular
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

// Se não chegarem dados, grava no log e avisa
if (!$input) {
    logMsg("ERRO: Nenhum dado recebido ou JSON inválido. Raw: " . $rawInput);
    echo json_encode(["error" => "Sem dados"]);
    exit;
}

logMsg("A enviar email para: " . $input['email']);

// 3. A TUA CHAVE (A mesma que funcionou no teste)
$apiKey = 'xsmtpsib-096288cfd596009ae6bdfce89b32912f80db09e7e7b28c9c61db1f2279e15312-TT1Davx8oCYtDjXn'; 

// 4. Configurar envio
$url = 'https://api.brevo.com/v3/smtp/email';

$data = [
    'sender' => ['name' => 'Quinta da Escola', 'email' => 'geral@quintadaescola.com'],
    'to' => [['email' => $input['email'], 'name' => $input['nome']]],
    'subject' => 'Confirmação de Inscrição - Quinta da Escola',
    'htmlContent' => "
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='UTF-8'>
      <style>
        body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .header { background-color: #2e7d32; padding: 30px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px; }
        .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
        .info-box { background-color: #f1f8e9; border-left: 5px solid #2e7d32; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .info-item { margin-bottom: 10px; font-size: 15px; }
        .label { font-weight: bold; color: #555; }
        .value { color: #2e7d32; font-weight: bold; }
        .footer { background-color: #eeeeee; padding: 20px; text-align: center; font-size: 12px; color: #888; }
        .btn { display: inline-block; background-color: #2e7d32; color: #ffffff !important; padding: 12px 25px; text-decoration: none; border-radius: 50px; font-weight: bold; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class='container'>
        <div class='header'>
          <h1>QUINTA DA ESCOLA</h1>
        </div>
        <div class='content'>
          <h2 style='color: #333; margin-top: 0;'>Olá, {$input['nome']}!</h2>
          <p>Ficamos muito contentes de ter escolhido a Quinta da Escola para mais umas férias fantásticas!</br></br>

A inscrição está confirmada e agora pode avançar para a próxima fase.</br></br>

Os dados para pagamento são:</br>

O pagamento deverá ser efetuado e o respetivo comprovativo enviado para info@quintadaescola.com.</br></br>

O NIB para o pagamento é PT50 0045 5242 4038 3330 5293 2</br></br>

Mais perto da data enviaremos o resto das informações para que nada falte nesta aventura.</br></br>
 
Estamos à disposição para qualquer esclarecimento adicional.</p>
          <div class='info-box'>
            <div class='info-item'><span class='label'>Turno:</span> <span style='color:#333'>{$input['turno']}</span></div>
            <div class='info-item'><span class='label'>Valor Total:</span> <span class='value'>{$input['valor']}€</span></div>
          </div>
          <center>
            <a href='mailto:info@quintadaescola.com' class='btn'>Enviar Comprovativo</a>
          </center>
        </div>
      </div>
    </body>
    </html>"
];

// 5. Enviar (COM A CORREÇÃO DO SSL)
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'api-key: ' . $apiKey,
    'Content-Type: application/json',
    'Accept: application/json'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

// --- A LINHA QUE FALTAVA (CRUCIAL!) ---
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); 
// ---------------------------------------

$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    $erro = curl_error($ch);
    logMsg("ERRO CRÍTICO CURL: " . $erro);
    http_response_code(500);
    echo json_encode(["error" => "Erro servidor", "details" => $erro]);
} else {
    logMsg("Resposta Brevo ($httpCode): " . $result);
    
    if ($httpCode >= 200 && $httpCode < 300) {
        echo json_encode(["success" => true]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Erro Brevo", "details" => $result]);
    }
}

curl_close($ch);
?>