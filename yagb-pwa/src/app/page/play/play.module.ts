import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { PlayPage } from './play.page';

@NgModule({
    imports: [IonicModule, CommonModule, FormsModule],
    declarations: [PlayPage],
})
export class PlayPageModule {}
