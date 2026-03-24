document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('sort').addEventListener('change', function() {
        const selectedOption = this.value;

        fetch('/sortEstablishments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sortOption: selectedOption })
        })
        .then(response => response.json())
        .then(data => {
            const placesContainer = document.querySelector('.places');
            placesContainer.innerHTML = '';

            const headlineLocation = data.headlineLocation;
            document.querySelector('.headline-location').textContent = headlineLocation;

            if (data.establishment_data && data.establishment_data.length > 0) {
                data.establishment_data.forEach(establishment => {
                    const establishmentDiv = document.createElement('div');
                    establishmentDiv.classList.add('establishment');

                    establishmentDiv.innerHTML = `
                        <img class="place-img" src="${establishment.banner_image}" alt="establishment"/>
                        <div class="info">
                            <div class="cafe-container">
                                <p class="cafe">${establishment.establishment_name}</p>
                                <div class="ratings-container">
                                    <p class="ratings">${establishment.establishment_ratings}</p>
                                    <i class="fa fa-star star-icon"></i>
                                </div>                                 
                            </div>
                            <div class="details">
                                <p class="location"><i class="fa fa-map-marker"></i>${establishment.establishment_address}</p>
                            </div>
                            <div class="description">
                                <p class="desc"><i class="fa fa-info-circle"></i>${establishment.establishment_description}</p>
                            </div>
                            <div class="button-container2">
                                <button id="see_more" onclick="redirectToEstablishment('${establishment.establishment_name}')">See More</button>
                            </div>
                        </div> 
                    `;

                    placesContainer.appendChild(establishmentDiv);
                });
            } else {
                placesContainer.innerHTML = '<p>No establishments found.</p>';
            }
        })
        .catch(error => console.error('Error:', error));
    });
});