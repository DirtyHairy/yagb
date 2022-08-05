import { AlertController } from '@ionic/angular';
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class AlertService {
    constructor(private alertController: AlertController) {}

    async errorMessage(message: string) {
        const alert = await this.alertController.create({
            header: 'Error',
            backdropDismiss: false,
            message,
            buttons: [{ text: 'Close', role: 'cancel' }],
        });

        await alert.present();
    }

    async message(header: string, message: string, extraButtons: Record<string, () => void> = {}, closeButtonLabel = 'Close') {
        const alert = await this.alertController.create({
            header,
            message,
            backdropDismiss: false,
            buttons: [
                ...Object.keys(extraButtons).map((text) => ({
                    text,
                    handler: () => {
                        alert.dismiss();
                        extraButtons[text]();
                    },
                })),
                { text: closeButtonLabel, role: 'cancel' },
            ],
        });

        await alert.present();
    }
}
