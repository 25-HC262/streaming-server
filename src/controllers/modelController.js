import { WebSocketServer, WebSocket } from 'ws';

// 엔드포인트 ws://3.34.11.17:8000/ws

// Websocket client 
const modelEndpoint = 'wss://model.trout-model.kro.kr/ws';
let modelWs = null;


// Connect to Model  
function connectToModel() {
    modelWs = new WebSocket(modelEndpoint);

    modelWs.onopen = () => {
        console.log('Successfully connected to model endpoint.');
    };

    modelWs.onclose = (event) => {
        console.warn('Disconnected from model endpoint. Retrying in 5s...', event.reason);
        setTimeout(connectToModel, 5000);
    };

    modelWs.onerror = (error) => {
        console.error('Model endpoint WebSocket error:', error.message);
    };

    modelWs.onmessage = (message) => {
        try {
            const data = JSON.parse(message.data);
            console.log(`Model server response: ${JSON.stringify(data)}`);
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'model_response',
                        text: data.text
                    }));
                }
            });
        } catch (error) {
            console.error('Failed to parse message from model:', message.data);
        }
    };
}

connectToModel(); 