<?php
// api/config.php

// --- 0. DEFINIÇÕES ---
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);

require __DIR__ . '/secrets.php';

// --- 1. ORIGEM ---
$http_origin    = $_SERVER['HTTP_ORIGIN'] ?? '';
$is_dev_request = str_contains($http_origin, 'localhost') || str_contains($http_origin, '127.0.0.1');

// --- 2. CORS ---
$allowed_origins = [
    'https://turnos.quintadaescola.com',
    'http://localhost:4200',
    'http://localhost:8100',
];

if (in_array($http_origin, $allowed_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $http_origin);
}

header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Access-Pin');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --- 3. BASE DE DADOS ---
$db_name = $is_dev_request ? DB_NAME_DEV : DB_NAME_PROD;

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . $db_name . ';charset=utf8mb4', DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    $msg = $is_dev_request ? "Erro DB ($db_name): " . $e->getMessage() : 'Erro de conexão à base de dados.';
    http_response_code(500);
    echo json_encode(['erro' => $msg]);
    exit();
}

// --- 4. HELPERS ---

/**
 * Termina o pedido com uma resposta JSON e um código HTTP.
 */
function json_response(array $data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data);
    exit();
}

/**
 * Codifica em Base64URL (RFC 4648 §5, sem padding).
 */
function base64url_encode(string $data): string
{
    return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
}

/**
 * Gera um JWT assinado com HS256.
 */
function generate_jwt(array $claims): string
{
    $header  = base64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload = base64url_encode(json_encode($claims));
    $sig     = base64url_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

// --- 5. AUTENTICAÇÃO ---

/**
 * Verifica o JWT do cabeçalho Authorization e devolve o payload.
 * Termina o pedido com 401 em caso de falha.
 */
function verificarAuth(): array
{
    $headers    = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        json_response(['erro' => 'Token ausente.'], 401);
    }

    $parts = explode('.', $matches[1]);
    if (count($parts) !== 3) {
        json_response(['erro' => 'Token inválido.'], 401);
    }

    $expected = base64url_encode(hash_hmac('sha256', $parts[0] . '.' . $parts[1], JWT_SECRET, true));
    if (!hash_equals($expected, $parts[2])) {
        json_response(['erro' => 'Assinatura inválida.'], 401);
    }

    $payload = json_decode(base64_decode($parts[1]), true);
    if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
        json_response(['erro' => 'Token expirado.'], 401);
    }

    return $payload;
}
