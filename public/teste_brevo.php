<?php
// api/teste_brevo.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "<h1>A iniciar teste...</h1>";

// 1. A TUA CHAVE (Cola aqui outra vez para garantir)
$apiKey = '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'; // <--- TUA CHAVE AQUI

// 2. Configuração
$url = 'https://api.brevo.com/v3/smtp/email';
$data = [
    // ATENÇÃO: Usa aqui o email com que te registaste no Brevo para garantir que funciona
    'sender' => ['name' => 'Teste', 'email' => 'geral@quintadaescola.com'], 
    'to' => [['email' => 'agueda.tap@gmail.com', 'name' => 'Eu Próprio']],
    'subject' => 'Teste de Conexão PHP -> Brevo',
    'htmlContent' => '<p>Se lês isto, o PHP e o Brevo estão a funcionar!</p>'
];

// 3. Enviar
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'api-key: ' . $apiKey,
    'Content-Type: application/json',
    'Accept: application/json'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
// Linha importante para servidores partilhados antigos:
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); 

$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    echo "<h2 style='color:red'>Erro de cURL: " . curl_error($ch) . "</h2>";
} else {
    echo "<h3>Código HTTP: $httpCode</h3>";
    echo "<pre>Resposta do Brevo: $result</pre>";
}

curl_close($ch);
?>