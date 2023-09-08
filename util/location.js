const axios = require('axios');

const API_KEY = process.env.YANDEX_API_KEY;

async function getCoordsForAddress(address) {
  const response = await axios.get(`https://geocode-maps.yandex.ru/1.x/?apikey=${API_KEY}&geocode=${encodeURIComponent(address)}&format=json`)
  const data = response.data;

  if (!data || data.statusCode === '403') { 
    return {
      lat: 40.7484474,
      lng: -73.9871516
    };
  }

  const coordinates = data.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos.split(' ');
  const latitude = coordinates[1];
  const longitude = coordinates[0];

  return {
    lat: latitude,
    lng: longitude
  };
}

module.exports = getCoordsForAddress;