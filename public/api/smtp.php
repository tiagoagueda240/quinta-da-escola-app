<?php
// api/smtp.php — Função reutilizável de envio SMTP direto (SSL, porta 465)
// Requer que as constantes SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
// SMTP_FROM e SMTP_FROM_NAME estejam definidas (via secrets.php).

/**
 * Envia email via SMTP com SSL usando fsockopen.
 * Retorna true em caso de sucesso ou uma string de erro.
 */
function enviarSmtp(string $para, string $assunto, string $htmlBody): bool|string {
    $socket = @fsockopen('ssl://' . SMTP_HOST, SMTP_PORT, $errno, $errstr, 30);
    if (!$socket) {
        return "Ligação SMTP falhou: $errstr ($errno)";
    }

    $ler = function() use ($socket): string {
        $resp = '';
        while ($linha = fgets($socket, 515)) {
            $resp .= $linha;
            if (substr($linha, 3, 1) !== '-') break;
        }
        return $resp;
    };

    $escrever = function(string $cmd) use ($socket): void {
        fputs($socket, $cmd . "\r\n");
    };

    // Saudação
    $resp = $ler();
    if (substr($resp, 0, 3) !== '220') { fclose($socket); return "Servidor não pronto: $resp"; }

    // EHLO
    $escrever('EHLO ' . gethostname());
    $ler();

    // AUTH LOGIN
    $escrever('AUTH LOGIN');
    $ler(); // 334 Username:
    $escrever(base64_encode(SMTP_USER));
    $ler(); // 334 Password:
    $escrever(base64_encode(SMTP_PASS));
    $resp = $ler();
    if (substr($resp, 0, 3) !== '235') { fclose($socket); return "Autenticação SMTP falhou: $resp"; }

    // MAIL FROM
    $escrever('MAIL FROM:<' . SMTP_FROM . '>');
    $resp = $ler();
    if (substr($resp, 0, 3) !== '250') { fclose($socket); return "MAIL FROM falhou: $resp"; }

    // RCPT TO
    $escrever('RCPT TO:<' . $para . '>');
    $resp = $ler();
    if (substr($resp, 0, 3) !== '250') { fclose($socket); return "RCPT TO falhou: $resp"; }

    // DATA
    $escrever('DATA');
    $resp = $ler();
    if (substr($resp, 0, 3) !== '354') { fclose($socket); return "DATA falhou: $resp"; }

    // Cabeçalhos + corpo
    $nomeEncoded    = '=?UTF-8?B?' . base64_encode(SMTP_FROM_NAME) . '?=';
    $assuntoEncoded = '=?UTF-8?B?' . base64_encode($assunto) . '?=';
    $mensagem  = "From: $nomeEncoded <" . SMTP_FROM . ">\r\n";
    $mensagem .= "To: $para\r\n";
    $mensagem .= "Subject: $assuntoEncoded\r\n";
    $mensagem .= "MIME-Version: 1.0\r\n";
    $mensagem .= "Content-Type: text/html; charset=UTF-8\r\n";
    $mensagem .= "Content-Transfer-Encoding: base64\r\n";
    $mensagem .= "\r\n";
    $mensagem .= chunk_split(base64_encode($htmlBody));
    $mensagem .= "\r\n.\r\n"; // ponto final DATA

    fputs($socket, $mensagem);
    $resp = $ler();
    if (substr($resp, 0, 3) !== '250') { fclose($socket); return "Envio falhou: $resp"; }

    $escrever('QUIT');
    fclose($socket);
    return true;
}
