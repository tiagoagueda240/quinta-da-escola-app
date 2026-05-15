<?php
// api/secrets.example.php
// Copiar este ficheiro para secrets.php e preencher com os valores reais.
// NUNCA commitar o secrets.php (está no .gitignore)

define('DB_HOST',      'localhost');
define('DB_USER',      'db_user');
define('DB_PASS',      'db_password');
define('DB_NAME_PROD', 'quinta_app_turnos');
define('DB_NAME_DEV',  'quinta_app_turnos-pre');

// Gerar um novo segredo com: php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"
define('JWT_SECRET', 'mudar_este_valor');
