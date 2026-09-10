const apiKey = 'AIzaSyB3hAPPGTIWm-3IZPoS8r_QR8A5BHpzzw8';
const targetUid = 'Bs7SYqZR2udwku8MpmUuDQ4aD2a2';
const newPassword = '.admin.';

async function resetPassword() {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localId: targetUid,
          password: newPassword,
          returnSecureToken: false,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ? data.error.message : 'Error al actualizar');
    }

    console.log('✅ Contraseña actualizada con éxito para el UID:', data.localId);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetPassword();