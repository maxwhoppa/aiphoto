// Map scenario IDs to their local asset images
const scenarioAssets: Record<string, any[]> = {
  professional: [
    require('../../assets/scenarios/professional/1.jpeg'),
    require('../../assets/scenarios/professional/2.jpeg'),
    require('../../assets/scenarios/professional/3.jpeg'),
    require('../../assets/scenarios/professional/4.png'),
    require('../../assets/scenarios/professional/5.png'),
  ],
  casual_fitting_room: [
    require('../../assets/scenarios/casual_fitting_room/1.jpeg'),
    require('../../assets/scenarios/casual_fitting_room/2.jpeg'),
    require('../../assets/scenarios/casual_fitting_room/3.jpeg'),
    require('../../assets/scenarios/casual_fitting_room/4.jpeg'),
    require('../../assets/scenarios/casual_fitting_room/5.jpeg'),
  ],
  white_photoshoot: [
    require('../../assets/scenarios/white_photoshoot/1.png'),
    require('../../assets/scenarios/white_photoshoot/2.png'),
    require('../../assets/scenarios/white_photoshoot/3.png'),
    require('../../assets/scenarios/white_photoshoot/4.png'),
    require('../../assets/scenarios/white_photoshoot/5.png'),
  ],
  coffee_new: [
    require('../../assets/scenarios/coffee_new/1.jpeg'),
    require('../../assets/scenarios/coffee_new/2.jpeg'),
    require('../../assets/scenarios/coffee_new/3.jpeg'),
    require('../../assets/scenarios/coffee_new/4.jpeg'),
    require('../../assets/scenarios/coffee_new/5.jpeg'),
  ],
  editorial_photoshoot: [
    require('../../assets/scenarios/editorial_photoshoot/1.jpeg'),
    require('../../assets/scenarios/editorial_photoshoot/2.jpeg'),
    require('../../assets/scenarios/editorial_photoshoot/3.jpeg'),
    require('../../assets/scenarios/editorial_photoshoot/4.jpeg'),
    require('../../assets/scenarios/editorial_photoshoot/5.jpeg'),
  ],
  hotel_bathroom: [
    require('../../assets/scenarios/hotel_bathroom/1.jpeg'),
    require('../../assets/scenarios/hotel_bathroom/2.jpeg'),
    require('../../assets/scenarios/hotel_bathroom/3.jpeg'),
    require('../../assets/scenarios/hotel_bathroom/4.jpeg'),
    require('../../assets/scenarios/hotel_bathroom/5.jpeg'),
  ],
  pinterest_thirst: [
    require('../../assets/scenarios/pinterest_thirst/1.jpeg'),
    require('../../assets/scenarios/pinterest_thirst/2.jpeg'),
    require('../../assets/scenarios/pinterest_thirst/3.jpeg'),
    require('../../assets/scenarios/pinterest_thirst/4.jpeg'),
    require('../../assets/scenarios/pinterest_thirst/5.jpeg'),
  ],
  photoshoot: [
    require('../../assets/scenarios/photoshoot/1.jpeg'),
    require('../../assets/scenarios/photoshoot/2.jpeg'),
    require('../../assets/scenarios/photoshoot/3.jpeg'),
    require('../../assets/scenarios/photoshoot/4.jpeg'),
    require('../../assets/scenarios/photoshoot/5.jpeg'),
  ],
  nature: [
    require('../../assets/scenarios/nature/1.jpg'),
    require('../../assets/scenarios/nature/2.jpeg'),
    require('../../assets/scenarios/nature/3.jpeg'),
    require('../../assets/scenarios/nature/4.jpeg'),
    require('../../assets/scenarios/nature/5.jpeg'),
  ],
  rooftop: [
    require('../../assets/scenarios/rooftop/1.jpeg'),
    require('../../assets/scenarios/rooftop/2.jpeg'),
    require('../../assets/scenarios/rooftop/3.jpeg'),
    require('../../assets/scenarios/rooftop/4.jpeg'),
    require('../../assets/scenarios/rooftop/5.jpeg'),
  ],
  sports: [
    require('../../assets/scenarios/sports/1.jpg'),
    require('../../assets/scenarios/sports/2.jpg'),
    require('../../assets/scenarios/sports/3.jpg'),
    require('../../assets/scenarios/sports/4.jpg'),
    require('../../assets/scenarios/sports/5.jpeg'),
  ],
  home: [
    require('../../assets/scenarios/home/1.jpg'),
    require('../../assets/scenarios/home/2.jpg'),
    require('../../assets/scenarios/home/3.jpg'),
    require('../../assets/scenarios/home/4.jpg'),
    require('../../assets/scenarios/home/5.jpg'),
  ],
  winter: [
    require('../../assets/scenarios/winter/1.jpg'),
    require('../../assets/scenarios/winter/2.jpg'),
    require('../../assets/scenarios/winter/3.jpg'),
    require('../../assets/scenarios/winter/4.jpg'),
    require('../../assets/scenarios/winter/5.jpg'),
  ],
};

export const getScenarioImages = (scenarioId: string): any[] => {
  return scenarioAssets[scenarioId] || [];
};