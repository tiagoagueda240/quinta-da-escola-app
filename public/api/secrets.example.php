<?php
// api/secrets.example.php
// Copiar este ficheiro para secrets.php e preencher com os valores reais.
// NUNCA commitar o secrets.php (está no .gitignore)

define('DB_HOST',      'localhost');
define('DB_USER',      'quint122_admin');
define('DB_PASS',      'senha_admin_site_app!turnos');
define('DB_NAME_PROD', 'quint122_admin');
define('DB_NAME_DEV',  'senha_admin_site_app!turnos');

// Gerar um novo segredo com: php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"
define('JWT_SECRET', 'UOsuINsbZGyf2GK/ZAOLl49QXOzrMb4I/F4fmDPa8yw=');
