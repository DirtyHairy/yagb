import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GamesPage } from './games.page';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';

@NgModule({
    imports: [IonicModule, CommonModule, FormsModule],
    declarations: [GamesPage],
})
export class GamesPageModule {}
