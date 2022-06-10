import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { Game } from './../../../model/game';
import { PopoverController } from '@ionic/angular';

@Component({
    selector: 'app-game-item',
    templateUrl: './game-item.component.html',
    styleUrls: ['./game-item.component.scss'],
})
export class GameItemComponent {
    constructor(private popoverController: PopoverController) {}

    get color(): string | undefined {
        if (this.selected) return 'primary';
        if (this.touched) return 'light';

        return undefined;
    }

    async onContextmenu(e: MouseEvent): Promise<void> {
        e.stopPropagation();
        e.preventDefault();

        this.interaction.emit();

        const popover = await this.popoverController.create({
            component: ContextMenuComponent,
            event: e,
            backdropDismiss: true,
            showBackdrop: false,
            componentProps: {
                onEdit: () => {
                    popover.dismiss();
                    this.edit.emit();
                },
                onDelete: () => {
                    popover.dismiss();
                    this.delete.emit();
                },
                onReset: () => {
                    popover.dismiss();
                    this.reset.emit();
                },
            },
        });

        popover.present();
    }

    @Input()
    game: Game | undefined;

    @Input()
    selected = false;

    @Input()
    touched = false;

    @Output()
    delete = new EventEmitter<Game>();

    @Output()
    edit = new EventEmitter<Game>();

    @Output()
    reset = new EventEmitter<Game>();

    @Output()
    selectItem = new EventEmitter<Game>();

    @Output()
    interaction = new EventEmitter<Game>();
}
