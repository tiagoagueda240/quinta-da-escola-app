<?php
require 'config.php';

// --- CONFIGURAÇÃO MANUAL ---
$emailDoUtilizador = 'agueda.tap@gmail.com'; // O email que queres alterar
$novaSenha = 'tapa200o';               // A nova senha em texto limpo
// ---------------------------

try {
    // Gerar o hash seguro (o mesmo que o auth.php usa para verificar)
    $novoHash = password_hash($novaSenha, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE email = ?");
    $stmt->execute([$novoHash, $emailDoUtilizador]);

    if ($stmt->rowCount() > 0) {
        echo "✅ Sucesso: A senha de [$emailDoUtilizador] foi atualizada!";
    } else {
        echo "❌ Erro: Utilizador não encontrado ou a senha já era a mesma.";
    }
} catch (PDOException $e) {
    echo "❌ Erro de Base de Dados: " . $e->getMessage();
}

// AVISO: Apaga este ficheiro do servidor depois de usar!
?>