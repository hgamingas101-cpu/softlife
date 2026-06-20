document.addEventListener("DOMContentLoaded", function () {
    
    const urlParams = new URLSearchParams(window.location.search);
    const pinFromQR = urlParams.get('pin'); // Si escaneas el QR, viene ?pin=123456

    const formArea = document.getElementById('bridgeLoginFormArea');
    const successArea = document.getElementById('bridgeSuccessArea');
    const statusMsg = document.getElementById('statusMsg');
    const btnConnect = document.getElementById('btnConnectMobile');
    const inputs = document.querySelectorAll('.pin-input');

    // 1. MAGIC: Si escaneas el QR desde la cámara del celular
    if (pinFromQR && pinFromQR.length === 6) {
        pinFromQR.split('').forEach((char, i) => {
            if (inputs[i]) inputs[i].value = char;
        });
        checkPinComplete();
        // Auto-conectar al segundo de escanear
        setTimeout(() => btnConnect.click(), 800);
    }

    // 2. LÓGICA DE LOS CUADROS (Estilo AnyDesk)
    inputs.forEach((input, index) => {
        // Solo permitir números
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/\D/g, '');
            e.target.value = value;
            if (value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
            checkPinComplete();
        });

        // Borrar para atrás regresa al cuadro anterior
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && index > 0) {
                inputs[index - 1].focus();
            }
            if (e.key === 'Enter') btnConnect.click();
        });

        // Soporte para pegar el código completo
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            pasteData.split('').forEach((char, i) => {
                if (inputs[i]) inputs[i].value = char;
            });
            if (inputs[pasteData.length - 1]) inputs[pasteData.length - 1].focus();
            checkPinComplete();
        });
    });

    function checkPinComplete() {
        const pin = Array.from(inputs).map(i => i.value).join('');
        btnConnect.disabled = pin.length !== 6;
    }

    function getPin() {
        return Array.from(inputs).map(i => i.value).join('');
    }

    // 3. ENVIAR EL PIN AL SERVIDOR FLASK
    btnConnect.addEventListener('click', async () => {
        const pin = getPin();
        btnConnect.disabled = true;
        btnConnect.textContent = 'Verificando...';
        statusMsg.className = 'status-msg';
        statusMsg.textContent = '';

        // Extraemos la IP que viene en la URL del QR (?ip=10.xxx.xxx.xxx)
        // Si no viene ninguna (alguien entró manual), usamos tu IP por defecto o localhost
        const ipFromUrl = urlParams.get('ip') || '10.232.197.85'; 
        const backendUrl = `http://${ipFromUrl}:5000/api/validate_pin`;

        try {
            const resp = await fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin })
            });
            const data = await resp.json();
        if (data.status === 'ok') {
                formArea.style.display = 'none';
                successArea.style.display = 'block';
                statusMsg.className = 'status-msg success';
                statusMsg.textContent = '✅ ¡Conectado con éxito! Cargando interfaz...';

                const streamUrl = `http://${ipFromUrl}:5000/api/stream`;
                const container = document.getElementById('screenContainer');
                
                // Inyectamos la imagen con un ID para poder escuchar los clics
                container.innerHTML = `
                    <img id="pcScreen" src="${streamUrl}" 
                         alt="Pantalla de la PC" 
                         style="width: 100%; max-width: 100%; border-radius: 8px; border: 2px solid #2563eb; cursor: crosshair; touch-action: none;"
                    />
                `;

                const pcScreen = document.getElementById('pcScreen');

                // Detectar el clic o toque en la pantalla del celular
                pcScreen.addEventListener('click', async (e) => {
                    // Obtener el tamaño de la imagen tal como se está viendo en el celular
                    const rect = pcScreen.getBoundingClientRect();
                    
                    // Calcular el porcentaje de dónde se hizo clic (de 0.0 a 1.0)
                    const clickX = (e.clientX - rect.left) / rect.width;
                    const clickY = (e.clientY - rect.top) / rect.height;

                    // Enviar las coordenadas al servidor Flask en segundo plano
                    try {
                        await fetch(`http://${ipFromUrl}:5000/api/mouse_click`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ x: clickX, y: clickY })
                        });
                    } catch (err) {
                        console.error("Error al enviar evento de clic:", err);
                    }
                });
            }
             else {
                statusMsg.className = 'status-msg error';
                statusMsg.textContent = `❌ ${data.msg}`;
                btnConnect.disabled = false;
                btnConnect.textContent = 'Conectar Dispositivo';
                inputs.forEach(i => i.value = '');
                inputs[0].focus();
            }
        } catch (error) {
            console.error(error);
            statusMsg.className = 'status-msg error';
            statusMsg.textContent = '⚠️ Asegúrate de estar en la misma red WiFi que la PC.';
            btnConnect.disabled = false;
            btnConnect.textContent = 'Conectar Dispositivo';
        }
    });
});