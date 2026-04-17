<?php
// api/config.php

// --- 0. SETTINGS ---
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);

// --- 1. DETETAR QUEM ESTÁ A CHAMAR (ORIGEM) ---
$http_origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Se a origem contiver "localhost", sabemos que és tu no teu PC
$is_dev_request = (strpos($http_origin, 'localhost') !== false || strpos($http_origin, '127.0.0.1') !== false);

// --- 2. CORS (Permitir Localhost e Produção) ---
$allowed_origins = [
    "https://turnos.quintadaescola.com",
    "http://localhost:4200",
    "http://localhost:8100" // Caso uses Ionic/Mobile
];

if (in_array($http_origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: " . $http_origin);
}

header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Access-Pin");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --- 3. ESCOLHA DA BASE DE DADOS ---
$db_host = "localhost";
$db_user = "quinta_admin";
$db_pass = "senha_admin_site_app!turnos";

if ($is_dev_request) {
    // === TU NO PC (PRE) ===
    // Usa a base de dados de testes (a original)
$db_name = "quinta_app_turnos-pre";
    
} else {
    // === UTILIZADORES NO SITE (PRO) ===
    // Usa a base de dados de produção (nova)
    $db_name = "quinta_app_turnos"; 
}

// --- 4. LIGAÇÃO ---
$jwt_secret = "UOsuINsbZGyf2GK/ZAOLl49QXOzrMb4I/F4fmDPa8yw="; 

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $e) {
    http_response_code(500);
    // Debug: Se for dev, mostra qual BD tentou ligar e o erro
    if ($is_dev_request) {
        echo json_encode(["erro" => "Erro DB ($db_name): " . $e->getMessage()]);
    } else {
        echo json_encode(["erro" => "Erro de conexão à base de dados."]);
    }
    exit();
}

// --- 5. AUTH ---
function verificarAuth() {
    global $jwt_secret;
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(["erro" => "Token ausente."]);
        exit();
    }

    $token = $matches[1];
    $parts = explode('.', $token);

    if (count($parts) != 3) {
        http_response_code(401); echo json_encode(["erro" => "Token inválido."]); exit();
    }

    $signature_check = base64_encode(hash_hmac('sha256', $parts[0] . "." . $parts[1], $jwt_secret, true));
    $signature_check = str_replace(['+', '/', '='], ['-', '_', ''], $signature_check);

    if ($signature_check !== $parts[2]) {
        http_response_code(401); echo json_encode(["erro" => "Assinatura inválida."]); exit();
    }

    return json_decode(base64_decode($parts[1]), true);
}
?>