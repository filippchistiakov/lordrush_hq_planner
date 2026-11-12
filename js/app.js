(() => {
  'use strict';

  const P = window.Planner;

  function seed() {
    P.objects = [
      P.make('hq', 48, 48),
      P.make('trap1', 31, 47),
      P.make('trap2', 66, 47),
      P.make('banner', 43, 49),
      P.make('banner', 57, 49)
    ];
    P.center();
    P.refresh();
  }

  if (P.loadFromStorage) P.loadFromStorage();

  if (!P.objects.length) {
    seed();
  } else {
    P.center();
    P.refresh();
  }
})();
