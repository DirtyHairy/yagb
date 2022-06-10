import { CommonModule } from '@angular/common';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { Tab1Page } from './tab1.page';

@NgModule({
    imports: [IonicModule, CommonModule, FormsModule, ExploreContainerComponentModule],
    declarations: [Tab1Page],
})
export class Tab1PageModule {}
