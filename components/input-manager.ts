
/**
 * @name focus
 * @desc focuses input element
 */
const focus = function(): void {

    // exit early if the input is not visible
    if (this.input.isFocused) {
        return;
    }

    // set input as focused and unselect tag
    this.renderer.invokeElementMethod(this.input.element, 'focus', []);
    this.input.isFocused = true;
    this.selectItem(undefined);
};


/**
 * @name blur
 */
const blur = function(): void {
    this.input.isFocused = false;
};

export const input = {
    element: <HTMLElement>undefined,
    isFocused: <boolean>false,

    // methods
    focus: focus,
    blur: blur
};

