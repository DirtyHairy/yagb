import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { SettingsPage } from './settings.page';

@NgModule({
    imports: [IonicModule, CommonModule, FormsModule],
    declarations: [SettingsPage],
})
export class SettingsPageModule {}
