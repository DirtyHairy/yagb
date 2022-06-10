import { CommonModule } from '@angular/common';
import { ContextMenuComponent } from './context-menu/context-menu.component';
import { FormsModule } from '@angular/forms';
import { GameItemComponent } from './game-item/game-item.component';
import { GamesPage } from './games.page';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';

@NgModule({
    imports: [IonicModule, CommonModule, FormsModule],
    declarations: [GamesPage, GameItemComponent, ContextMenuComponent],
})
export class GamesPageModule {}
