import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
// import { useLanguage } from '../context/LanguageContext';
import { ChevronRight, ChevronLeft, Star, Heart, Bookmark, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export const Home = () => {
  const { logs, points, creatures, areas, currentUser, toggleFavorite, toggleWanted } = useApp();
  // const { t } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Popular Spots for Carousel (Pickup)
  // Note: Using 'logs' (current user's logs) for popularity ranking for now.
  // Ideally this should use global stats or filtered by available data.
  const pickupSpots = points
    .map(point => ({ ...point, logCount: logs.filter(l => l.spotId === point.id).length }))
    .sort((a, b) => b.logCount - a.logCount)
    .slice(0, 5);

  // All Creatures for Grid
  const allCreatures = creatures;

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % pickupSpots.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [pickupSpots.length]);

  // if (isLoading) return null; // Handled by Layout
  if (pickupSpots.length === 0) {
    return <div className="p-8 text-center bg-gray-50 rounded-xl m-4">Loading data...</div>;
  }

  return (
    <div className="pb-24">
      {/* Pickup Carousel Section - Exact Replica Style */}
      <section className="bg-white pt-8 pb-12 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full border-8 border-gray-900"></div>
          <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-gray-900"></div>
        </div>

        <div className="max-w-[1280px] mx-auto px-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-600 font-black shadow-sm text-xl" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>P</div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
              <span className="text-cyan-500">PICK</span> UP
            </h2>
          </div>

          <div className="relative h-[400px] rounded-[2rem] overflow-hidden bg-gray-50 shadow-inner group">
            <AnimatePresence mode='wait'>
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex items-center"
              >
                <div className="w-full h-full flex flex-col md:flex-row">
                  {/* Image Side */}
                  <div className="w-full md:w-1/2 h-1/2 md:h-full relative overflow-hidden">
                    <img
                      src={pickupSpots[currentSlide].imageUrl}
                      alt={pickupSpots[currentSlide].name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent"></div>
                  </div>

                  {/* Info Side */}
                  <div className="w-full md:w-1/2 h-1/2 md:h-full p-8 md:p-12 flex flex-col justify-center bg-white relative">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-400 to-blue-500"></div>

                    <div className="text-sm font-bold text-gray-400 mb-2">No.{String(currentSlide + 1).padStart(3, '0')}</div>
                    <h3 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 leading-tight" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
                      {pickupSpots[currentSlide].name}
                    </h3>

                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className={clsx(
                        "px-4 py-1 rounded-full text-sm font-bold text-white shadow-sm",
                        pickupSpots[currentSlide].level === 'Beginner' ? "bg-cyan-400" :
                          pickupSpots[currentSlide].level === 'Intermediate' ? "bg-blue-400" :
                            "bg-indigo-400"
                      )}>
                        {pickupSpots[currentSlide].level}
                      </span>
                      <span className="px-4 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-600">
                        {areas.find(a => a.id === pickupSpots[currentSlide].areaId)?.name}
                      </span>
                    </div>

                    <p className="text-gray-600 font-medium leading-relaxed mb-8 line-clamp-3">
                      {pickupSpots[currentSlide].description}
                    </p>

                    <Link
                      to={`/point/${pickupSpots[currentSlide].id}`}
                      className="inline-flex items-center justify-center gap-2 bg-cyan-500 text-white px-8 py-4 rounded-full font-bold hover:bg-cyan-600 transition-colors self-start shadow-lg shadow-cyan-200"
                    >
                      View Details <ChevronRight size={20} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Carousel Controls */}
            <button
              onClick={() => setCurrentSlide((prev) => (prev - 1 + pickupSpots.length) % pickupSpots.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-gray-900 hover:bg-white transition-colors shadow-lg z-10"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => setCurrentSlide((prev) => (prev + 1) % pickupSpots.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-gray-900 hover:bg-white transition-colors shadow-lg z-10"
            >
              <ChevronRight size={24} />
            </button>

            {/* Dots */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {pickupSpots.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={clsx(
                    "w-3 h-3 rounded-full transition-all shadow-sm",
                    idx === currentSlide ? "bg-cyan-500 w-8" : "bg-white/80 hover:bg-white"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* Pokemon List Grid - Strict Replica from Screenshot */}
      <section className="max-w-[1280px] mx-auto px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {allCreatures.map((creature) => {
            const isFavorite = currentUser.favorites.includes(creature.id);
            const isWanted = currentUser.wanted.includes(creature.id);
            const isDiscovered = currentUser.logs.some(logId => {
              const log = logs.find(l => l.id === logId);
              return log?.creatureId === creature.id;
            });

            return (
              <Link
                key={creature.id}
                to={`/creature/${creature.id}`}
                className="group block w-full relative"
              >
                {/* Image Container - White Box with Border */}
                <div className="bg-white border border-gray-200 rounded-[10px] aspect-square flex items-center justify-center mb-2 overflow-hidden transition-shadow hover:shadow-md relative">
                  <img
                    src={creature.imageUrl}
                    alt={creature.name}
                    className="w-[85%] h-[85%] object-contain group-hover:scale-110 transition-transform duration-300"
                  />

                  {/* Action Buttons (Visible on Hover or if active) */}
                  <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        toggleFavorite(creature.id);
                      }}
                      className={clsx(
                        "p-1.5 rounded-full shadow-sm transition-colors",
                        isFavorite ? "bg-red-50 text-red-500" : "bg-white text-gray-400 hover:text-red-500"
                      )}
                    >
                      <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        toggleWanted(creature.id);
                      }}
                      className={clsx(
                        "p-1.5 rounded-full shadow-sm transition-colors",
                        isWanted ? "bg-yellow-50 text-yellow-500" : "bg-white text-gray-400 hover:text-yellow-500"
                      )}
                    >
                      <Bookmark size={16} fill={isWanted ? "currentColor" : "none"} />
                    </button>
                  </div>

                  {/* Discovered Badge */}
                  {isDiscovered && (
                    <div className="absolute top-2 left-2 bg-green-500 text-white p-1 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>

                {/* Name and Rarity */}
                <div className="px-1">
                  <h3 className="text-sm font-bold text-gray-700 group-hover:text-gray-900 leading-tight mb-1">
                    {creature.name}
                  </h3>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 4 }).map((_, i) => {
                      const rarityLevel = creature.rarity === 'Legendary' ? 4 :
                        creature.rarity === 'Epic' ? 3 :
                          creature.rarity === 'Rare' ? 2 : 1;
                      const isActive = i < rarityLevel;
                      return (
                        <Star
                          key={i}
                          size={10}
                          className={isActive ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}
                        />
                      );
                    })}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <button className="bg-white border border-gray-300 text-gray-600 px-12 py-3 rounded-full font-bold hover:bg-gray-100 transition-colors text-sm">
            もっと見る
          </button>
        </div>
      </section>
    </div>
  );
};
