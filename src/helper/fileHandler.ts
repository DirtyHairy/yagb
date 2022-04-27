export class FileHandler {
    openFile(handler: (data: Uint8Array, name: string) => void, accept?: string) {
        if (this.fileInput) {
            document.body.removeChild(this.fileInput);
        }

        this.fileInput = document.createElement('input');

        this.fileInput.style.display = 'none';
        this.fileInput.multiple = false;
        this.fileInput.type = 'file';

        if (accept) {
            this.fileInput.accept = accept;
        }

        this.fileInput.addEventListener('change', async (e) => {
            const target = e.target as HTMLInputElement;

            if (!target.files) return;

            const file = target.files.item(0);
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => handler(new Uint8Array(reader.result as ArrayBuffer), file.name);
            reader.onerror = () => console.error(`failed to read file ${file.name}`, reader.error);

            reader.readAsArrayBuffer(file);
        });

        document.body.appendChild(this.fileInput as Node);
        this.fileInput?.click();
    }

    private fileInput: HTMLInputElement | undefined;
}
