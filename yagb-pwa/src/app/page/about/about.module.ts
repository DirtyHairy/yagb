import { AboutPage } from './about.page';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';

@NgModule({
    imports: [IonicModule, CommonModule, FormsModule],
    declarations: [AboutPage],
})
export class AboutPageModule {}
