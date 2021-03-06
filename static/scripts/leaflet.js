(function() {
  // $(document).ready(function() {
    let submitState = false;
    $('#submit').click(function () {
      if (submitState === false) {
        addCrosshair();
        submitState = true;
        $(this).text("Submit Trash Can");
      } else {
        submitState = false;
        mymap.removeLayer(crosshair);
        $(this).text("Show Trash Can Locator");
        center = mymap.getCenter();
        $.ajax({
          url: '/add',
          type: 'POST',
          contentType: 'application/json',
          dataType: 'json',
          data: JSON.stringify({'latitude': center.lat, 'longitude': center.lng}),
          success: function (data) {
            if (data.status === "time") {
              alert("Please wait to submit another location");
            } else if (data.status === "duplicate") {
              alert("Duplicate Post");
            } else if (data.status === "error") {
              alert("Invalid parameters");
            } else if (data.status === "nothing found") {
              alert("No nearby trash cans")
            } else {
              // Adds the new marker to the map with the Delete button
              var popup = data.name + '<br/>' + '<div class="ui button" id="delete">Delete Trash Can</div>';
              var marker = L.marker([data.latitude, data.longitude], {icon: greenIcon}).bindPopup(popup).addTo(mymap);
            }
          }
        })
      }
    });
  // });

  // Create Map
  var mymap = L.map('mapid').setView([37.752, -122.447], 16);
  L.tileLayer('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(mymap);

  // Create marker group layer to easily remove markers to refresh page
  var markerGroup = L.layerGroup().addTo(mymap);

  mymap.locate();

  mymap.on('locationfound', function (info) {
    // var radius = info.accuracy / 7;
    mymap.setView([info.latitude, info.longitude], 16)
    L.circle(info.latlng, 10).addTo(mymap);
    $.ajax({
      url: '/api/bins/proximity',
      type: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({'latitude': info.latitude, 'longitude': info.longitude}),
      success: putMarkers
    })
  });

  mymap.on('locationerror', function (info) {
    mymap.setView([37.752, -122.447], 16);
    let coords = mymap.getCenter()
    $.ajax({
      url: '/api/bins/proximity',
      type: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({'latitude': coords.lat, 'longitude': coords.lng}),
      success: putMarkers
    })
  });

  // Create icon for crosshair
  var crosshairIcon = L.icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-black.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  function addCrosshair () {
    // Add in a crosshair for the map
    crosshair = new L.marker(mymap.getCenter(), {icon: crosshairIcon, clickable:false});
    crosshair.addTo(mymap);

    // Move the crosshair to the center of the map when the user pans
    mymap.on('move', function(e) {
        crosshair.setLatLng(mymap.getCenter());
    });
  }

  var greenIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // Add button on map
  L.easyButton('<span class="search" title="Search This Area">&circlearrowright;</span>', function() {
    // Remove markers currently on map
    mymap.removeLayer(markerGroup);
    // Get the new center of map
    let coords = mymap.getCenter();
    // Get the markers
    $.ajax({
      url: '/api/bins/proximity',
      type: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({'latitude': coords.lat, 'longitude': coords.lng}),
      success: putMarkers
    })
  }).addTo(mymap);

    // Add button on map o locate self if the map moves
    // L.easyButton('<span class="re-locate" title="Find your location">&curren;</span>', function() {
    //   mymap.locate();
    // }).addTo(mymap);

  function putMarkers (data) {
    if (data.status === "error") {
      alert("Invalid parameters!");
    } else {
      markerGroup = L.layerGroup().addTo(mymap);
      // Populates markers on map
      // var markerClusters = L.markerClusterGroup();
      for(var i = 0 ; i <= data.length-1; i++) {
        if (data[i].user_id) {
          var popupInfo = data[i].name + '<br/>' + '<div class="ui button" id="delete">Delete Trash Can</div>';
          var marker = L.marker([data[i].latitude, data[i].longitude], {icon: greenIcon}).bindPopup(popupInfo);
        } else {
          var popupInfo = data[i].name;
          var marker = L.marker([data[i].latitude, data[i].longitude]).bindPopup(popupInfo);
        }
        marker.addTo(markerGroup);
        // markerClusters.addLayer(marker);
        // mymap.addLayer(marker);
      };
      // mymap.addLayer(markerClusters); 
    }
  }

  mymap.on('popupopen', function (info) {
    $('#delete').click(function () {
      $.ajax({
        url: '/delete',
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({'latitude': info.popup._source._latlng.lat, 'longitude': info.popup._source._latlng.lng}),
        success: function (data) {
          // Removes the marker from the map
          if (data.status === "ok") {
            mymap.removeLayer(info.popup._source);
          } else {
            alert("Unable to delete marker")
          }
        }
      })
    });
  })

  navigator.geolocation.watchPosition(function(position) {

  },
  function (error) { 
    if (error.code == error.PERMISSION_DENIED)
        alert("Please allow geolocation, or I can't find the nearest Trash Cans to you easily!");
  });

})();
