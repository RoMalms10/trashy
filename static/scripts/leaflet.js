(function() {
  $(document).ready(function() {
    // Get the menu to show when it's small
    $('.sidebar.big.icon').click(function() {
      $('.ui.inverted.secondary.pointing.menu').toggleClass('ui inverted vertical menu')
    });  
  });

  var mymap = L.map('mapid').setView([37.752, -122.447], 16);
  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.streets',
    accessToken: 'pk.eyJ1Ijoicm9tYWxtczEwIiwiYSI6ImNqaHF6c2NvbTA3dmkzMHBwaWwzZmhibWIifQ.RpiKEopngPIF8x2SnDR5-g'
  }).addTo(mymap);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (pos) {

      //Center map around geolocation
      var geo = [pos.coords.latitude, pos.coords.longitude];
      mymap = mymap.setView(geo, 16);

      // Add circle around person
      var circle = L.circle(geo, {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.2,
        radius: 150
      }).addTo(mymap);
    })
  }
  $.get("/api/bins", function(data) {
    // Populates markers on map
    if(data) {
      var markerClusters = L.markerClusterGroup();
      for(var i = 0 ; i <= data.length-1; i++) {
        var popup = data[i].name + '<br/>' + 'Confirm Button Here';
        var marker = L.marker([data[i].location.lat, data[i].location.lng]).bindPopup(popup);
        markerClusters.addLayer(marker);
      };
      mymap.addLayer(markerClusters);  
    };
  })
})();
