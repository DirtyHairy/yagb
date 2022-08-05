import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { GameSettingsComponent } from './game-settings/game-settings.component';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';

@NgModule({
    declarations: [GameSettingsComponent],
    imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule],
    exports: [GameSettingsComponent],
})
export class SharedComponentModule {}
