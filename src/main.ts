import './styles.css';
import { initPWA } from './pwa';
import { route, startRouter } from './router';
import { payResultView, proView, profileView, progressView } from './views/account';
import { initCloud } from './cloud';
import { getLocale, setLocale } from './i18n';
import { exerciseView, libraryView } from './views/library';
import { quizView } from './views/quiz';
import { todayView, welcomeView } from './views/today';
import { workoutView } from './views/workout';
import { bodyView } from './views/body';
import { rehabView } from './views/rehab';

route('welcome', { view: welcomeView });
route('quiz', { view: quizView });
route('today', { view: todayView, tab: 'today', needsProfile: true });
route('workout', { view: workoutView, needsProfile: true });
route('library', { view: libraryView, tab: 'library' });
route('ex', { view: exerciseView });
route('body', { view: bodyView, tab: 'progress', needsProfile: true });
route('rehab', { view: rehabView, tab: 'today', needsProfile: true });
route('progress', { view: progressView, tab: 'progress', needsProfile: true });
route('profile', { view: profileView, tab: 'profile', needsProfile: true });
route('pro', { view: proView });
route('pay', { view: payResultView });

// language, direction and title apply to every screen, including ones opened by a direct link
setLocale(getLocale());

initPWA();
initCloud();
startRouter();
