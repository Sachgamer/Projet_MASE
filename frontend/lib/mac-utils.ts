/**
 * Utilitaires pour obtenir l'adresse MAC de la machine
 * Note: L'accès à la MAC est limité pour des raisons de sécurité dans les navigateurs modernes
 */

/**
 * Tente d'obtenir l'adresse MAC via WebRTC
 * Cette méthode est limitée et ne fonctionne que dans certains cas
 */
export async function getMacAddressViaWebRTC(): Promise<string | null> {
    try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        const candidates: string[] = [];

        pc.onicecandidate = (ice) => {
            if (ice && ice.candidate && ice.candidate.candidate) {
                candidates.push(ice.candidate.candidate);
            }
        };

        await pc.createDataChannel('');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Attendre un peu les ICE candidates
        await new Promise(resolve => setTimeout(resolve, 500));
        pc.close();

        // Chercher les candidats contenant une adresse MAC (format: xx:xx:xx:xx:xx:xx)
        for (const candidate of candidates) {
            const macMatch = candidate.match(/([0-9a-fA-F]{2}:){5}([0-9a-fA-F]{2})/);
            if (macMatch) {
                return macMatch[0].toUpperCase();
            }
        }
    } catch (error) {
        console.warn('Erreur lors de la récupération de la MAC via WebRTC:', error);
    }
    return null;
}

/**
 * Génère un identifiant unique basé sur les propriétés du navigateur et du dispositif
 * Utilisé comme fallback si la MAC réelle n'est pas disponible
 */
export async function getDeviceFingerprint(): Promise<string> {
    try {
        // Récupère les informations du navigateur
        const userAgent = navigator.userAgent;
        const language = navigator.language;
        const platform = navigator.platform;
        const hardwareConcurrency = navigator.hardwareConcurrency || 0;
        const maxTouchPoints = navigator.maxTouchPoints || 0;

        // Crée un identifiant unique
        const fingerprint = `${userAgent}|${language}|${platform}|${hardwareConcurrency}|${maxTouchPoints}`;
        
        // Simple hash de la string
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            const char = fingerprint.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        // Génère une fausse adresse MAC basée sur le hash
        const hashHex = Math.abs(hash).toString(16).padStart(12, '0');
        const mac = hashHex.match(/.{1,2}/g)?.join(':').toUpperCase() || '00:00:00:00:00:00';
        return mac;
    } catch (error) {
        console.warn('Erreur lors de la génération du fingerprint:', error);
        return '00:00:00:00:00:00';
    }
}

/**
 * Fonction principale pour obtenir l'adresse MAC
 * Essaie d'abord WebRTC, puis utilise un fallback
 */
export async function getMacAddress(): Promise<string> {
    // Essayer d'obtenir la MAC via WebRTC
    const macViaWebRTC = await getMacAddressViaWebRTC();
    if (macViaWebRTC) {
        console.log('MAC obtenue via WebRTC:', macViaWebRTC);
        return macViaWebRTC;
    }

    // Fallback: utiliser un fingerprint du dispositif
    const fingerprint = await getDeviceFingerprint();
    console.log('Utilisation du fingerprint du dispositif:', fingerprint);
    return fingerprint;
}
