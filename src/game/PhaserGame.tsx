import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { setGameInstance } from './sceneControl';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CityScene } from './scenes/CityScene';

export function PhaserGame() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent: ref.current,
      backgroundColor: '#0b0a12',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      render: { smoothPixelArt: true },
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scene: [BootScene, TitleScene, CityScene],
      audio: { noAudio: true },
      // The React overlay handles touch and mouse aiming; Phaser only needs the keyboard.
      input: { keyboard: true, mouse: false, touch: false, gamepad: false },
      disableContextMenu: true,
      banner: false,
    });
    setGameInstance(game);
    if (import.meta.env.DEV) (window as unknown as { __phaser: Phaser.Game }).__phaser = game;
    return () => {
      setGameInstance(null);
      game.destroy(true);
    };
  }, []);

  return <div ref={ref} className="absolute inset-0" />;
}
