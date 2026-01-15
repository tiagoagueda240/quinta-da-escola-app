const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// 1. Configuração do "Carteiro" (Gmail)
// Tens de gerar uma "App Password" na tua conta Google: https://myaccount.google.com/apppasswords
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "agueda.tap@gmail.com",
    pass: "aknz rkwx fylv ameq",   
  },
});

// 2. A Função que "Escuta" novas inscrições
exports.enviarEmailConfirmacao = functions.firestore
  .document("inscricoes/{idInscricao}")
  .onCreate(async (snap, context) => {
    
    const dados = snap.data();
    
    // Verificações de segurança simples
    if (!dados || !dados.ee || !dados.ee.email) {
      console.log("Email não enviado: Dados incompletos.");
      return null;
    }

    const emailDestino = dados.ee.email;
    const nomeCrianca = dados.participante.nomeCompleto;
    const turno = dados.turnoEscolhido;
    const valor = dados.valorTotal;

    // 3. O Design do Email (HTML)
    const conteudoEmail = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2e7d32;">🌲 Inscrição Recebida!</h2>
        <p>Olá,</p>
        <p>A inscrição do(a) <strong>${nomeCrianca}</strong> para o <strong>${turno}</strong> foi registada com sucesso.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #2e7d32;">
          <p style="margin: 0; font-size: 1.1em;"><strong>Valor a Pagar:</strong> ${valor}€</p>
          <p style="margin: 10px 0 0 0;"><strong>IBAN:</strong> PT50 0000 0000 0000 0000 0000 0</p>
          <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #666;">(Por favor, envia o comprovativo respondendo a este email)</p>
        </div>

        <p>Ficamos à espera da tua confirmação!</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 0.8em; color: #888;"><em>Equipa Quinta da Escola</em></p>
      </div>
    `;

    const mailOptions = {
      from: '"Quinta da Escola" <o.teu.email@gmail.com>', // <--- O MESMO EMAIL DA CONFIGURAÇÃO
      to: emailDestino,
      subject: `Inscrição Confirmada: ${nomeCrianca}`,
      html: conteudoEmail,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("Email enviado com sucesso para:", emailDestino);
      
      // Opcional: Marcar na base de dados que o email foi enviado
      return snap.ref.update({ emailEnviado: true });
    } catch (erro) {
      console.error("Erro ao enviar email:", erro);
      return null;
    }
  });