'use strict';
import { eventSys, PublicAPI } from './global.js';
import { EVENTS as e, RANK } from './conf.js';
import { openColorPicker, absMod } from './util/misc.js';
import { elements, mouse, misc } from './main.js';
import { colorUtils as color } from './util/color.js';
import { renderer } from './canvas_renderer.js';
import { cursors } from './tool_renderer.js';
import { tools } from './tools.js';
import { Fx } from './Fx.js';

export { updateClientFx };

let toolSelected = null;

const palette = [[0, 0, 0], [0, 0, 255], [0, 255, 0], [255, 0, 0]];
let paletteIndex = 0;

export const undoHistory = [];

const clientFx = new Fx(-1, 0, 0, {color: 0});

let rank = RANK.NONE;

export const player = {
	get paletteIndex() { return paletteIndex; },
	set paletteIndex(i) {
		paletteIndex = absMod(i, palette.length);
		updatePalette();
	},
	get selectedColor() { return palette[paletteIndex]; },
	set selectedColor(c) {
		addPaletteColor(c);
	},
	get palette() { return palette; },
	get rank() { return isAdmin ? "ADMIN" : "USER" },
	get tool() { return toolSelected; },
	set tool(name) {
		let t = tools[name];
		if (t) {
			toolSelected = t;
		}
	},
	get toolId() { return tools[toolSelected].id; },
	get tools() { return tools; },
	getToolById: getToolById
};

PublicAPI.player = player;

function getToolById(id) {
	for (var t in tools) {
		if (tools[t].id === id) {
			return tools[t];
		}
	}
}

function changedColor() {
	updateClientFx(true);
	updatePaletteIndex();
}

function updatePalette() {
	var paletteColors = elements.paletteColors;
	paletteColors.innerHTML = "";
	var colorClick = (index) => () => {
		paletteIndex = index;
		updatePaletteIndex();
	};
	var colorDelete = (index) => () => {
		if(palette.length > 1) {
			palette.splice(index, 1);
			if(paletteIndex > index || paletteIndex === palette.length) {
				--paletteIndex;
			}
			updatePalette();
			updatePaletteIndex();
		}
	};
	
	for (var i = 0; i < palette.length; i++) {
		var element = document.createElement("div");
		var clr = palette[i];
		element.style.backgroundColor = "rgb(" + clr[2] + "," + clr[1] + "," + clr[0] + ")";
		element.onmouseup = function(e) {
			switch(e.button) {
				case 0:
					this.sel();
					break;
				case 2:
					this.del();
					break;
			}
			return false;
		}.bind({
			sel: colorClick(i),
			del: colorDelete(i)
		});
		element.oncontextmenu = () => false;
		paletteColors.appendChild(element);
	}
	updatePaletteIndex();
}

function updatePaletteIndex() {
	elements.paletteColors.style.transform = "translateY(" + (-paletteIndex * 40) + "px)";
}

function addPaletteColor(color) {
	for (var i = 0; i < palette.length; i++) {
		if (palette[i][0] === color[0] && palette[i][1] === color[1] && palette[i][2] === color[2]) {
			paletteIndex = i;
			updatePaletteIndex();
			return;
		}
	}
	paletteIndex = palette.length;
	palette.push(color);
	updatePalette();
}


function updateToolbar() {
	let toolButtonClick = id => event => {
		selectTool(id);
		event.stopPropagation();
	};
	
	var toolSelect = elements.toolSelect;
	toolSelect.innerHTML = "";
	
	// Add tools to the tool-select menu
	for (var i = 0; i < tools.length; i++) {
		if (!tools[i].adminTool || isAdmin) {
			var element = document.createElement("button");
			var container = document.createElement("div");
			var tool = tools[i];
			element.id = "tool-" + i;
			element.addEventListener("click", toolButtonClick(i));
			if (i === toolSelected) {
				container.style.backgroundImage = "url(" + cursors.slotset + ")";
				element.className = "selected";
			} else {
				container.style.backgroundImage = "url(" + cursors.set.src + ")";
			}
			container.style.backgroundPosition = tool.setposition;
			element.appendChild(container);
			toolSelect.appendChild(element);
		}
	}
	if (tools.length !== 0) {
		selectTool(0);
	}
};



function selectTool(id) {
	if(id === toolSelected || !tools[id]) {
		return;
	}
	toolSelected = id;
	tools[id].call("select");
	var children = elements.toolSelect.children;
	for (var i=0; i<children.length; i++) {
		children[i].className = "";
		children[i].children[0].style.backgroundImage = "url(" + cursors.set.src + ")";
	}
	var element = document.getElementById("tool-" + id);
	var container = element.children[0];
	container.style.backgroundImage = "url(" + cursors.slotset + ")";
	element.className = "selected";
	elements.viewport.style.cursor = "url(" + tools[id].cursorblob + ") " + tools[id].offset[0] + " " + tools[id].offset[1] + ", pointer";
	mouse.validClick = false;
	updateClientFx(true);
}

function updateClientFx(force) {
	var fxtileX = clientFx.x;
	var fxtileY = clientFx.y;
	var tileX   = Math.floor(mouse.worldX / 16);
	var tileY   = Math.floor(mouse.worldY / 16);
	var rgb = player.selectedColor;
	    rgb = color.u24_888(rgb[2], rgb[1], rgb[0]);
	var tool = tools[toolSelected];
	if (tool !== undefined && (fxtileX !== tileX || fxtileY !== tileY || force)) {
		var valid = misc.world !== null && misc.world.validMousePos(tileX, tileY);
		if (valid) {
			clientFx.update(tool.fxType, tileX, tileY, {color: rgb});
		} else {
			clientFx.update(-1, tileX, tileY, {color: rgb});
		}
		renderer.render(renderer.rendertype.FX);
		return true;
	}
	return false;
}

eventSys.on(e.net.sec.rank, rank => {
	switch (rank) {
		case RANK.NONE:
			break;

		case RANK.USER:
			break;

		case RANK.ADMIN:
			showDevChat(true);
			break;
	}
});

eventSys.once(e.init, () => {
	elements.paletteCreate.onclick = () => openColorPicker(player.selectedColor, addPaletteColor);
	updatePalette();
});