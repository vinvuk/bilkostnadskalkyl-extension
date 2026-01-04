/**
 * Icon generator script for Bilkostnadskalkyl Chrome extension
 * Creates simple PNG icons from embedded base64 data
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'icons');

// Simple blue car icon PNGs encoded in base64
// These are minimal placeholder icons with a blue background and white car silhouette

const ICONS = {
  16: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA0klEQVR42mNgGAWDHjAic/7//z8DiPn/H8T4D8SMKM4AYtaHCIHo/yBJRiAGMf4DCfw/ANUB5wO1MDAwMAPN+w8U+A8yAKQWRD8E8v8DxWAmMDAwMILcADTgP9Cg/0ADQQb8h7oByIcG/3+o4UDJByD6ISQIfoCKQdUAbfoPDIf/0Nj4D3UTyNz/0Jj5D8oGqYXGFlwNTCEiMAYfALgJCQ7yYCA+APcmJhygaQB2MKQFxwCPBZIxj1Y5kIiJ8DEQP5QUxxAXvJTkSGIKc6IlZwBj8XobWW9XSAAAAABJRU5ErkJggg==',
  48: 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABsklEQVR4nO2YPU7DQBCFv1gJCgqKSBQ0NKGhoaGhSZWCC3ADKhpuQMMNaGhoKLgBDQ0NDQ0NDRIFRUSBRYFMsStlgx0nNus4kV/zFI93Zvc9z4yTGSgpKSkZT4j6JIQQqtqMn99WCLqtCjqF6Pclqn6o0UeiLVEXVb0L5PsvIEgdqAtU/YIQ8ghE/zcgBhcQn0JVvyIEF4igT8XfKqTYAUHqH3Gp34sY/E1cF1L/VfyPEJNAK6TeCzFJJNIp1Aip/zX8uxADd4AgdYa4Noh+Fn3gKQRpg2jHBqkLxKUBsRuISwviPxB3l1F0A/FewFdI/TL6tRA/ICYBJ4W4BPr2KIL0CbgLOH4ByKfhXD4K56fRV+FyIfpXoX+PQvwUmkvDuQbEBeBdA+IIcOt8LoEuPYqQdwH3ERAXgBsJiEvA4d+guD6lmA2iQIq7TaF6A+LSGLS9i8Ol0DDAjYRQ/xJChGjvBqE/i6hfRr8W4u5c3BtEAeJd6P9RCNKm0L8RYpJIpNMvId/E30J3n0JE+gG+XYj+r6JfC/H3AeFCDKkLxKWBmC2IG8D9I+4OongqxCTQHqUGKisP+EEzAAAAAElFTkSuQmCC',
  128: 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAD8klEQVR4nO3cS24TQRSG4b+aJMAAQ4YMGTJkyBIYsgRGLIEhS4AlMGQJDBmyBIYMGTJkyBJgyBIYQuIYsHGcTjp2d9V/3fW+zwQ5cVdXnzrVNZUA4p6ZWW1mx8zsqJkdMbNDZrbPzPaY2U4z22Fme8xsu5ltN7NdZrbLzPaY2T4z229mB8zsoJkdMrMjZnbUzI6b2TEzO2FmJ83slJmdNrMzZnbWzM6b2QUzu2hml8zsspldMbNrZnbdzG6Y2S0zu21md8zsnpk9MLOHZvbIzB6b2RMze2pmT8xsr5k9NrOHZnbfzO6Y2W0zu2Vmt83srpk9MLMnZvbMzJ6b2QszWzezDTN7ZWavzey1mb0xs7dm9s7M3pvZBzP7aGafzOyzmX0xsy9m9tXM/jGzr2b2zcx+mtkvZvabmW2Y2Wam2szWzGyrmW01s21mttPMdpnZbjPbY2Z7zWy/mR0ws0NmdtjMjprZcTM7aWanzeysmZ03s4tmdtnMrprZdTO7ZWZ3zey+mT00s8dm9tTMnpnZczN7YWbrzGyDmb02szfmttfM7DOzT2b22cy+mNk3M/tuZj/M7KeZ/WZmv5vZ72a2ycw2m9kWM9tiZlvNbJuZ7TCzXWa228z2mtl+MztoZofN7KiZHTez02Z21szOm9klM7tiZtfM7KaZ3TazewuP9cjMnpjZMzN7bmYvzGzdzDaY2Ssz22hmb8zsnZl9MLNP5vbFzL6a2Tcz+8PM/jCz383sdzPbbGabzWyLmW01s+1mttPMdpvZXjM7YGaHzOyImR03s1NmdtbMLpjZZTO7Zmb/d5R3zOy+mT0ysydm9tzMXprZupm9NrO3ZvbezD6a2Wcz+2JmX83sm5n9aWZ/mtnvZrbJzDab2VYz225mu8xsj5ntN7ODZnbEzE6Y2WkzO29ml8zsqpndMLO7ZvbQzJ6Y2XMze2lm683stZm9NbMPZvbJzL6Y2Tcz+8PM/jSz383sdzPbZGZbzGyrmW03s11mttfMDpjZITM7amYnzey0mZ0zs4tmdtnMrpnZTTO7a2YPzOyxmT01s+dm9tLM1pvZazN7Z2YfzOyzuX0xs29m9oeZ/W5mm8xss5ltMbNtZrbTzHab2V4zO2Bmh8zsqJmdMLPTZnbOzC6a2RUzu25mt8zsgZk9MbNnZvbCzNaZ2YaZvTazN2b23sw+mtlnM/tqZt/N7IeZ/WJmv5nZb2a2ycy2mNlWM9thZrvMbI+Z7TOzA2Z2yMyOmNlxMztlZmfN7IKZXTazq2Z208zum9kjM3tqZs/N7IWZrTOzDWb2yszemtl7M/tkZl/M7JuZ/WFmf5rZ72a2ycw2m9kWM9tqZjvMbJeZ7TGzfWZ2wMwOmdkRMztmZifN7LSZnTOzi2Z22cyumtl1M7tlZvfM7IGZPTazp2b2zMyen8+/eAEHAPwLfUYbXOB1KW8AAAAASUVORK5CYII='
};

/**
 * Generates and saves icons from base64 data
 */
function generateIcons() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const [size, base64Data] of Object.entries(ICONS)) {
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `icon${size}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(filepath, buffer);
    console.log(`Generated: ${filename}`);
  }

  console.log('\nAll icons generated successfully!');
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

generateIcons();
