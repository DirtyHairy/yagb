import { CommonModule } from '@angular/common';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { Tab2Page } from './tab2.page';

@NgModule({
    imports: [IonicModule, CommonModule, FormsModule, ExploreContainerComponentModule],
    declarations: [Tab2Page],
})
export class Tab2PageModule {}
