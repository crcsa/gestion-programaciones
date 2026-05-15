/**
 * Fuente: DANE – DIVIPOLA (División Político-Administrativa de Colombia)
 * Versión 2023. 33 departamentos / 1.122 municipios.
 */

export interface ColombiaLocation {
  department: string
  municipalities: string[]
}

export const COLOMBIA_LOCATIONS: ColombiaLocation[] = [
  {
    department: 'Amazonas',
    municipalities: [
      'El Encanto', 'La Chorrera', 'La Pedrera', 'La Victoria', 'Leticia',
      'Mirití-Paraná', 'Puerto Alegría', 'Puerto Arica', 'Puerto Nariño',
      'Puerto Santander', 'Tarapacá',
    ],
  },
  {
    department: 'Antioquia',
    municipalities: [
      'Abejorral', 'Abriaquí', 'Alejandría', 'Amagá', 'Amalfi', 'Andes',
      'Angelópolis', 'Angostura', 'Anorí', 'Ansermanuevo', 'Anserma',
      'Anzá', 'Apartadó', 'Arboletes', 'Argelia', 'Armenia', 'Barbosa',
      'Bello', 'Betania', 'Betulia', 'Briceño', 'Buriticá', 'Cáceres',
      'Caicedo', 'Caldas', 'Campamento', 'Cañasgordas', 'Caracolí',
      'Caramanta', 'Carepa', 'Carolina del Príncipe', 'Caucasia', 'Chigorodó',
      'Cisneros', 'Ciudad Bolívar', 'Cocorná', 'Concepción', 'Concordia',
      'Copacabana', 'Dabeiba', 'Don Matías', 'Ebéjico', 'El Bagre',
      'El Carmen de Viboral', 'El Santuario', 'Entrerríos', 'Envigado',
      'Fredonia', 'Frontino', 'Giraldo', 'Girardota', 'Gómez Plata',
      'Granada', 'Guadalupe', 'Guarne', 'Guatapé', 'Heliconia', 'Hispania',
      'Itagüí', 'Ituango', 'Jardín', 'Jericó', 'La Ceja', 'La Estrella',
      'La Pintada', 'La Unión', 'Liborina', 'Maceo', 'Marinilla', 'Medellín',
      'Montebello', 'Murindó', 'Mutatá', 'Nariño', 'Necoclí', 'Nechí',
      'Olaya', 'Peñol', 'Peque', 'Pueblorrico', 'Puerto Berrío', 'Puerto Nare',
      'Puerto Triunfo', 'Remedios', 'Retiro', 'Rionegro', 'Sabanalarga',
      'Sabaneta', 'Salgar', 'San Andrés de Cuerquia', 'San Carlos', 'San Francisco',
      'San Jerónimo', 'San José de la Montaña', 'San Juan de Urabá',
      'San Luis', 'San Pedro de los Milagros', 'San Pedro de Urabá',
      'San Rafael', 'San Roque', 'San Vicente Ferrer', 'Santa Bárbara',
      'Santa Fe de Antioquia', 'Santa Rosa de Osos', 'Santo Domingo',
      'Segovia', 'Sonsón', 'Sopetrán', 'Támesis', 'Tarazá', 'Tarso',
      'Titiribí', 'Toledo', 'Turbo', 'Uramita', 'Urrao', 'Valdivia',
      'Valparaíso', 'Vegachí', 'Venecia', 'Vigía del Fuerte', 'Yalí',
      'Yarumal', 'Yolombó', 'Yondó', 'Zaragoza',
    ],
  },
  {
    department: 'Arauca',
    municipalities: [
      'Arauca', 'Arauquita', 'Cravo Norte', 'Fortul', 'Puerto Rondón',
      'Saravena', 'Tame',
    ],
  },
  {
    department: 'Atlántico',
    municipalities: [
      'Baranoa', 'Barranquilla', 'Campo de la Cruz', 'Candelaria', 'Galapa',
      'Juan de Acosta', 'Luruaco', 'Malambo', 'Manatí', 'Palmar de Varela',
      'Piojó', 'Polonuevo', 'Ponedera', 'Puerto Colombia', 'Repelón',
      'Sabanagrande', 'Sabanalarga', 'Santa Lucía', 'Santo Tomás', 'Soledad',
      'Suán', 'Tubará', 'Usiacurí',
    ],
  },
  {
    department: 'Bogotá D.C.',
    municipalities: ['Bogotá D.C.'],
  },
  {
    department: 'Bolívar',
    municipalities: [
      'Achí', 'Altos del Rosario', 'Arenal', 'Arjona', 'Arroyohondo',
      'Barranco de Loba', 'Calamar', 'Cantagallo', 'Cartagena de Indias',
      'Cicuco', 'Clemencia', 'Córdoba', 'El Carmen de Bolívar', 'El Guamo',
      'El Peñón', 'Hatillo de Loba', 'Magangué', 'Mahates', 'Margarita',
      'María La Baja', 'Mompox', 'Montecristo', 'Morales', 'Norosí',
      'Pinillos', 'Regidor', 'Río Viejo', 'San Cristóbal', 'San Estanislao',
      'San Fernando', 'San Jacinto', 'San Jacinto del Cauca', 'San Juan Nepomuceno',
      'San Martín de Loba', 'San Pablo', 'Santa Catalina', 'Santa Rosa',
      'Santa Rosa del Sur', 'Simití', 'Soplaviento', 'Talaigua Nuevo',
      'Tiquisio', 'Turbaco', 'Turbaná', 'Villanueva', 'Zambrano',
    ],
  },
  {
    department: 'Boyacá',
    municipalities: [
      'Almeida', 'Aquitania', 'Arcabuco', 'Belén', 'Berbeo', 'Betéitiva',
      'Boavita', 'Boyacá', 'Briceño', 'Buenavista', 'Busbanzá', 'Caldas',
      'Campohermoso', 'Cerinza', 'Chinavita', 'Chiquinquirá', 'Chíquiza',
      'Chiscas', 'Chita', 'Chitaraque', 'Chivatá', 'Ciénega', 'Cómbita',
      'Coper', 'Corrales', 'Covarachía', 'Cubará', 'Cucaita', 'Cuítiva',
      'Duitama', 'El Cocuy', 'El Espino', 'Firavitoba', 'Floresta',
      'Gachantivá', 'Gameza', 'Garagoa', 'Guacamayas', 'Guateque', 'Guayatá',
      'Güicán', 'Iza', 'Jenesano', 'Jericó', 'La Capilla', 'La Uvita',
      'La Victoria', 'Labranzagrande', 'Macanal', 'Maripí', 'Miraflores',
      'Mongua', 'Monguí', 'Moniquirá', 'Motavita', 'Muzo', 'Nobsa',
      'Nuevo Colón', 'Oicatá', 'Otanche', 'Pachavita', 'Páez', 'Paipa',
      'Pajarito', 'Panqueba', 'Pauna', 'Paya', 'Paz de Río', 'Pesca',
      'Pisba', 'Puerto Boyacá', 'Quípama', 'Ramiriquí', 'Ráquira', 'Rondón',
      'Saboyá', 'Sáchica', 'Samacá', 'San Eduardo', 'San José de Pare',
      'San Luis de Gaceno', 'San Mateo', 'San Miguel de Sema', 'San Pablo de Borbur',
      'Santa María', 'Santa Rosa de Viterbo', 'Santa Sofía', 'Santana',
      'Sativanorte', 'Sativasur', 'Siachoque', 'Soatá', 'Socotá', 'Socha',
      'Sogamoso', 'Somondoco', 'Sora', 'Soracá', 'Sotaquirá', 'Susacón',
      'Sutamarchán', 'Sutatenza', 'Tasco', 'Tenza', 'Tibaná', 'Tibasosa',
      'Tinjacá', 'Tipacoque', 'Toca', 'Togüí', 'Tópaga', 'Toguíza',
      'Tota', 'Tunja', 'Tununguá', 'Turmequé', 'Tuta', 'Tutazá',
      'Umbita', 'Ventaquemada', 'Villa de Leyva', 'Viracachá', 'Zetaquira',
    ],
  },
  {
    department: 'Caldas',
    municipalities: [
      'Aguadas', 'Anserma', 'Aranzazu', 'Belalcázar', 'Chinchiná',
      'Filadelfia', 'La Dorada', 'La Merced', 'Manizales', 'Manzanares',
      'Marmato', 'Marquetalia', 'Marulanda', 'Neira', 'Norcasia', 'Pácora',
      'Palestina', 'Pensilvania', 'Riosucio', 'Risaralda', 'Salamina',
      'Samaná', 'San José', 'Supía', 'Victoria', 'Villamaría', 'Viterbo',
    ],
  },
  {
    department: 'Caquetá',
    municipalities: [
      'Albania', 'Belén de los Andaquíes', 'Cartagena del Chairá', 'Curillo',
      'El Doncello', 'El Paujil', 'Florencia', 'La Montañita', 'Milán',
      'Morelia', 'Puerto Rico', 'San José del Fragua', 'San Vicente del Caguán',
      'Solano', 'Solita', 'Valparaíso',
    ],
  },
  {
    department: 'Casanare',
    municipalities: [
      'Aguazul', 'Chámeza', 'Hato Corozal', 'La Salina', 'Maní',
      'Monterrey', 'Nunchía', 'Orocué', 'Paz de Ariporo', 'Pore',
      'Recetor', 'Sabanalarga', 'Sácama', 'San Luis de Palenque', 'Támara',
      'Tauramena', 'Trinidad', 'Villanueva', 'Yopal',
    ],
  },
  {
    department: 'Cauca',
    municipalities: [
      'Almaguer', 'Argelia', 'Balboa', 'Bolívar', 'Buenos Aires', 'Cajibío',
      'Caldono', 'Caloto', 'Coconuco', 'Corinto', 'El Tambo', 'Florencia',
      'Guachené', 'Guapi', 'Inzá', 'Jambaló', 'La Sierra', 'La Vega',
      'López de Micay', 'Mercaderes', 'Miranda', 'Morales', 'Padilla',
      'Páez', 'Patía', 'Piamonte', 'Piendamó', 'Popayán', 'Puerto Tejada',
      'Puracé', 'Rosas', 'San Sebastián', 'Santa Rosa', 'Santander de Quilichao',
      'Silvia', 'Sotara', 'Suárez', 'Sucre', 'Timbío', 'Timbiquí',
      'Toribío', 'Totoró', 'Villa Rica',
    ],
  },
  {
    department: 'Cesar',
    municipalities: [
      'Aguachica', 'Agustín Codazzi', 'Astrea', 'Becerril', 'Bosconia',
      'Chimichagua', 'Chiriguaná', 'Curumaní', 'El Copey', 'El Paso',
      'Gamarra', 'González', 'La Gloria', 'La Jagua de Ibirico', 'La Paz',
      'Manaure Balcón del Cesar', 'Pailitas', 'Pelaya', 'Pueblo Bello',
      'Río de Oro', 'San Alberto', 'San Diego', 'San Martín', 'Tamalameque',
      'Valledupar',
    ],
  },
  {
    department: 'Chocó',
    municipalities: [
      'Acandí', 'Alto Baudó', 'Atrato', 'Bagadó', 'Bahía Solano',
      'Bajo Baudó', 'Bojayá', 'Carmen del Darién', 'Cértegui', 'Condoto',
      'El Carmen de Atrato', 'El Litoral del San Juan', 'Istmina', 'Juradó',
      'Lloró', 'Medio Atrato', 'Medio Baudó', 'Medio San Juan', 'Nóvita',
      'Nuquí', 'Quibdó', 'Río Iro', 'Río Quito', 'Riosucio', 'San José del Palmar',
      'Sipí', 'Tadó', 'Unguía', 'Unión Panamericana',
    ],
  },
  {
    department: 'Córdoba',
    municipalities: [
      'Ayapel', 'Buenavista', 'Canalete', 'Cereté', 'Chimá', 'Chinú',
      'Ciénaga de Oro', 'Cotorra', 'La Apartada', 'Lorica', 'Los Córdobas',
      'Momil', 'Montelíbano', 'Montería', 'Moñitos', 'Planeta Rica',
      'Pueblo Nuevo', 'Puerto Escondido', 'Puerto Libertador', 'Purísima',
      'Sahagún', 'San Andrés de Sotavento', 'San Antero', 'San Bernardo del Viento',
      'San Carlos', 'San José de Uré', 'San Pelayo', 'Tierralta', 'Tuchín',
      'Valencia',
    ],
  },
  {
    department: 'Cundinamarca',
    municipalities: [
      'Agua de Dios', 'Albán', 'Anapoima', 'Anolaima', 'Apulo',
      'Arbeláez', 'Beltrán', 'Bituima', 'Bojacá', 'Cabrera', 'Cachipay',
      'Cajicá', 'Caparrapí', 'Cáqueza', 'Carmen de Carupa', 'Chaguaní',
      'Chía', 'Chipaque', 'Choachí', 'Chocontá', 'Cogua', 'Cota',
      'Cucunubá', 'El Colegio', 'El Peñón', 'El Rosal', 'Facatativá',
      'Fomeque', 'Fosca', 'Funza', 'Fúquene', 'Fusagasugá', 'Gachalá',
      'Gachancipá', 'Gachetá', 'Gama', 'Girardot', 'Granada', 'Guachetá',
      'Guaduas', 'Guasca', 'Guataquí', 'Guatavita', 'Guayabal de Síquima',
      'Guayabetal', 'Gutiérrez', 'Jerusalén', 'Junín', 'La Calera',
      'La Mesa', 'La Palma', 'La Peña', 'La Vega', 'Lenguazaque',
      'Machetá', 'Madrid', 'Manta', 'Medina', 'Mosquera', 'Nariño',
      'Nemocón', 'Nilo', 'Nimaima', 'Nocaima', 'Pacho', 'Paime',
      'Pandi', 'Paratebueno', 'Pasca', 'Puerto Salgar', 'Pulí', 'Quebradanegra',
      'Quetame', 'Quipile', 'Ricaurte', 'San Antonio del Tequendama',
      'San Bernardo', 'San Cayetano', 'San Francisco', 'San Juan de Rioseco',
      'Sasaima', 'Sesquilé', 'Sibaté', 'Silvania', 'Simijaca', 'Soacha',
      'Sopó', 'Subachoque', 'Suesca', 'Supatá', 'Susa', 'Sutatausa',
      'Tabio', 'Tausa', 'Tena', 'Tenjo', 'Tibacuy', 'Tibirita',
      'Tocaima', 'Tocancipá', 'Topaipí', 'Ubalá', 'Ubaque', 'Ubaté',
      'Une', 'Útica', 'Venecia', 'Vergara', 'Vianí', 'Villagómez',
      'Villapinzón', 'Villeta', 'Viotá', 'Yacopí', 'Zipacón', 'Zipaquirá',
    ],
  },
  {
    department: 'Guainía',
    municipalities: [
      'Barranco Minas', 'Cacahual', 'Inírida', 'La Guadalupe', 'Mapiripana',
      'Morichal', 'Pana Pana', 'Puerto Colombia', 'San Felipe',
    ],
  },
  {
    department: 'Guaviare',
    municipalities: [
      'Calamar', 'El Retorno', 'Miraflores', 'San José del Guaviare',
    ],
  },
  {
    department: 'Huila',
    municipalities: [
      'Acevedo', 'Agrado', 'Aipe', 'Algeciras', 'Altamira', 'Baraya',
      'Campoalegre', 'Colombia', 'Elías', 'Garzón', 'Gigante', 'Guadalupe',
      'Hobo', 'Iquira', 'Isnos', 'La Argentina', 'La Plata', 'Nátaga',
      'Neiva', 'Oporapa', 'Paicol', 'Palermo', 'Palestina', 'Pital',
      'Pitalito', 'Rivera', 'Saladoblanco', 'San Agustín', 'Santa María',
      'Suaza', 'Tarqui', 'Tello', 'Teruel', 'Tesalia', 'Timaná',
      'Villavieja', 'Yaguará',
    ],
  },
  {
    department: 'La Guajira',
    municipalities: [
      'Albania', 'Barrancas', 'Dibulla', 'Distracción', 'El Molino',
      'Fonseca', 'Hatonuevo', 'La Jagua del Pilar', 'Maicao', 'Manaure',
      'Riohacha', 'San Juan del Cesar', 'Uribia', 'Urumita', 'Villanueva',
    ],
  },
  {
    department: 'Magdalena',
    municipalities: [
      'Algarrobo', 'Aracataca', 'Ariguaní', 'Cerro de San Antonio', 'Chivolo',
      'Ciénaga', 'Concordia', 'El Banco', 'El Piñón', 'El Retén',
      'Fundación', 'Guamal', 'Nueva Granada', 'Pedraza', 'Pijiño del Carmen',
      'Pivijay', 'Plato', 'Pueblo Viejo', 'Remolino', 'Sabanas de San Ángel',
      'Salamina', 'San Sebastián de Buenavista', 'San Zenón', 'Santa Ana',
      'Santa Bárbara de Pinto', 'Santa Marta', 'Sitionuevo', 'Tenerife',
      'Zapayán', 'Zona Bananera',
    ],
  },
  {
    department: 'Meta',
    municipalities: [
      'Acacías', 'Barranca de Upía', 'Cabuyaro', 'Castilla la Nueva', 'Cubarral',
      'Cumaral', 'El Calvario', 'El Castillo', 'El Dorado', 'Fuente de Oro',
      'Granada', 'Guamal', 'La Macarena', 'La Uribe', 'Lejanías',
      'Mapiripán', 'Mesetas', 'Puerto Concordia', 'Puerto Gaitán', 'Puerto Lleras',
      'Puerto López', 'Puerto Rico', 'Restrepo', 'San Carlos de Guaroa',
      'San Juan de Arama', 'San Juanito', 'San Martín', 'Villavicencio',
      'Vista Hermosa',
    ],
  },
  {
    department: 'Nariño',
    municipalities: [
      'Albán', 'Aldana', 'Ancuyá', 'Arboleda', 'Barbacoas', 'Belén',
      'Buesaco', 'Chachagüí', 'Colón', 'Consacá', 'Contadero', 'Córdoba',
      'Cuaspud', 'Cumbal', 'Cumbitara', 'El Charco', 'El Peñol', 'El Rosario',
      'El Tablón de Gómez', 'El Tambo', 'Francisco Pizarro', 'Funes',
      'Guachucal', 'Guaitarilla', 'Gualmatán', 'Iles', 'Imués', 'Ipiales',
      'La Cruz', 'La Florida', 'La Llanada', 'La Tola', 'La Unión',
      'Leiva', 'Linares', 'Los Andes', 'Magüí', 'Mallama', 'Mosquera',
      'Nariño', 'Olaya Herrera', 'Ospina', 'Pasto', 'Pizarro', 'Policarpa',
      'Potosí', 'Providencia', 'Puerres', 'Pupiales', 'Ricaurte', 'Roberto Payán',
      'Samaniego', 'San Bernardo', 'San Lorenzo', 'San Pablo', 'San Pedro de Cartago',
      'Sandoná', 'Santa Bárbara', 'Santacruz', 'Sapuyes', 'Taminango',
      'Tangua', 'Tumaco', 'Túquerres', 'Yacuanquer',
    ],
  },
  {
    department: 'Norte de Santander',
    municipalities: [
      'Ábrego', 'Arboledas', 'Bochalema', 'Bucarasica', 'Cácota',
      'Cachirá', 'Chinácota', 'Chitagá', 'Convención', 'Cúcuta',
      'Cucutilla', 'Durania', 'El Carmen', 'El Tarra', 'El Zulia',
      'Gramalote', 'Hacarí', 'Herrán', 'La Esperanza', 'La Playa',
      'Labateca', 'Los Patios', 'Lourdes', 'Mutiscua', 'Ocaña',
      'Pamplona', 'Pamplonita', 'Puerto Santander', 'Ragonvalia',
      'Salazar', 'San Calixto', 'San Cayetano', 'Santiago', 'Sardinata',
      'Silos', 'Teorama', 'Tibú', 'Toledo', 'Villacaro', 'Villa del Rosario',
    ],
  },
  {
    department: 'Putumayo',
    municipalities: [
      'Colón', 'Mocoa', 'Orito', 'Puerto Asís', 'Puerto Caicedo',
      'Puerto Guzmán', 'Puerto Leguízamo', 'San Francisco', 'San Miguel',
      'Santiago', 'Sibundoy', 'Valle del Guamuez', 'Villagarzón',
    ],
  },
  {
    department: 'Quindío',
    municipalities: [
      'Armenia', 'Buenavista', 'Calarcá', 'Circasia', 'Córdoba',
      'Filandia', 'Génova', 'La Tebaida', 'Montenegro', 'Pijao',
      'Quimbaya', 'Salento',
    ],
  },
  {
    department: 'Risaralda',
    municipalities: [
      'Apía', 'Balboa', 'Belén de Umbría', 'Dosquebradas', 'Guática',
      'La Celia', 'La Virginia', 'Marsella', 'Mistrató', 'Pereira',
      'Pueblo Rico', 'Quinchía', 'Santa Rosa de Cabal', 'Santuario',
    ],
  },
  {
    department: 'San Andrés, Providencia y Santa Catalina',
    municipalities: ['Providencia', 'San Andrés'],
  },
  {
    department: 'Santander',
    municipalities: [
      'Aguada', 'Albania', 'Aratoca', 'Barbosa', 'Barichara', 'Barrancabermeja',
      'Betulia', 'Bolívar', 'Bucaramanga', 'Cabrera', 'California',
      'Capitanejo', 'Carcasí', 'Cepitá', 'Cerrito', 'Charalá', 'Charta',
      'Chimá', 'Chipatá', 'Cimitarra', 'Concepción', 'Confines', 'Contratación',
      'Coromoro', 'Curití', 'El Carmen de Chucurí', 'El Guacamayo',
      'El Playón', 'Encino', 'Enciso', 'Florián', 'Floridablanca', 'Galán',
      'Gámbita', 'Girón', 'Guaca', 'Guadalupe', 'Guapotá', 'Guavatá',
      'Güepsa', 'Hato', 'Jesús María', 'Jordán', 'La Belleza', 'La Paz',
      'Landázuri', 'Lebrija', 'Los Santos', 'Macaravita', 'Málaga',
      'Matanza', 'Mogotes', 'Molagavita', 'Ocamonte', 'Oiba', 'Onzaga',
      'Palmar', 'Palmas del Socorro', 'Páramo', 'Piedecuesta', 'Pinchote',
      'Puente Nacional', 'Puerto Parra', 'Puerto Wilches', 'Rionegro',
      'Sabana de Torres', 'San Andrés', 'San Benito', 'San Gil', 'San Joaquín',
      'San José de Miranda', 'San Miguel', 'San Vicente de Chucurí',
      'Santa Bárbara', 'Santa Helena del Opón', 'Simacota', 'Socorro',
      'Suaita', 'Sucre', 'Suratá', 'Tona', 'Valle de San José', 'Vélez',
      'Vetas', 'Villanueva', 'Zapatoca',
    ],
  },
  {
    department: 'Sucre',
    municipalities: [
      'Buenavista', 'Caimito', 'Chalán', 'Colosó', 'Corozal', 'Coveñas',
      'El Roble', 'Galeras', 'Guaranda', 'La Unión', 'Los Palmitos',
      'Majagual', 'Morroa', 'Ovejas', 'Palmito', 'Sampués', 'San Benito Abad',
      'San Juan de Betulia', 'San Luis de Sincé', 'San Marcos', 'San Onofre',
      'San Pedro', 'Sincelejo', 'Sucre', 'Tolú', 'Toluviejo',
    ],
  },
  {
    department: 'Tolima',
    municipalities: [
      'Alpujarra', 'Alvarado', 'Ambalema', 'Anzoátegui', 'Armero',
      'Ataco', 'Cajamarca', 'Carmen de Apicalá', 'Casabianca', 'Chaparral',
      'Coello', 'Coyaima', 'Cunday', 'Dolores', 'Espinal', 'Falan',
      'Flandes', 'Fresno', 'Guamo', 'Herveo', 'Honda', 'Ibagué',
      'Icononzo', 'Lérida', 'Líbano', 'Mariquita', 'Melgar', 'Murillo',
      'Natagaima', 'Ortega', 'Palocabildo', 'Piedras', 'Planadas',
      'Prado', 'Purificación', 'Rioblanco', 'Roncesvalles', 'Rovira',
      'Saldaña', 'San Antonio', 'San Luis', 'Santa Isabel', 'Suárez',
      'Valle de San Juan', 'Venadillo', 'Villahermosa', 'Villarrica',
    ],
  },
  {
    department: 'Valle del Cauca',
    municipalities: [
      'Alcalá', 'Andalucía', 'Ansermanuevo', 'Argelia', 'Bolívar',
      'Buenaventura', 'Buga', 'Bugalagrande', 'Caicedonia', 'Cali',
      'Calima', 'Candelaria', 'Cartago', 'Dagua', 'El Águila', 'El Cairo',
      'El Cerrito', 'El Dovio', 'Florida', 'Ginebra', 'Guacarí',
      'Jamundí', 'La Cumbre', 'La Unión', 'La Victoria', 'Obando',
      'Palmira', 'Pradera', 'Restrepo', 'Riofrío', 'Roldanillo',
      'San Pedro', 'Sevilla', 'Toro', 'Trujillo', 'Tuluá', 'Ulloa',
      'Versalles', 'Vijes', 'Yotoco', 'Yumbo', 'Zarzal',
    ],
  },
  {
    department: 'Vaupés',
    municipalities: ['Carurú', 'Mitú', 'Pacoa', 'Papunaua', 'Taraira', 'Yavaraté'],
  },
  {
    department: 'Vichada',
    municipalities: [
      'Cumaribo', 'La Primavera', 'Puerto Carreño', 'Santa Rosalía',
    ],
  },
]

export const DEPARTMENT_NAMES = COLOMBIA_LOCATIONS.map((l) => l.department)

export function getMunicipalities(department: string): string[] {
  return COLOMBIA_LOCATIONS.find((l) => l.department === department)?.municipalities ?? []
}

/** Infiere el departamento a partir del nombre del municipio (útil en modo edición). */
export function getDepartmentForMunicipality(municipality: string): string {
  return (
    COLOMBIA_LOCATIONS.find((l) => l.municipalities.includes(municipality))?.department ?? ''
  )
}
