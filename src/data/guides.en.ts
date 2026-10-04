/**
 * English coaching content for each exercise. Mirrors GUIDES in guides.ts:
 * same keys, same order, and the same array lengths and item order, because
 * other code refers to `cues` and `mistakes` by index.
 */

import type { Guide } from './guides';

export const GUIDES_EN: Record<string, Guide> = {
  squat: {
    why: 'The foundation of every lower-body movement; it strengthens your thighs and glutes and makes everyday sitting down and standing up easier.',
    setup: [
      'Feet slightly wider than shoulder width, toes turned out 15 to 30 degrees.',
      'Spread your weight over three points of each foot: the heel, the base of the big toe and the base of the little toe.',
      'Hold your hands in front of your chest for balance, or reach them straight out in front of you.',
    ],
    steps: [
      'Send your hips back and your knees forward and slightly out at the same time, like sitting down on a chair behind you.',
      'Lower until your thighs are parallel to the floor, or as deep as you can go while your back stays flat.',
      'Stand up by pressing your whole foot into the floor; your hips and shoulders should rise together.',
      'Squeeze your glutes at the top without locking your knees.',
    ],
    cues: [
      'Knees track in line with your toes, over your second and third toes.',
      'Keep your heels planted on the floor the whole time.',
      'Keep your lower back neutral: not rounded, not over-arched.',
      'Chest open, eyes on the floor about two meters ahead.',
      'Take 2 to 3 seconds on the way down and about 1 second on the way up.',
    ],
    breath: 'Breathe in before you go down and keep your abs braced; breathe out halfway through the way up.',
    feel: 'Front of the thighs and glutes. If the front of your knee or your lower back hurts, reduce the depth.',
    mistakes: [
      { m: 'Your knees cave inward.', fix: 'Imagine you are trying to spread the floor apart with your feet; keep your knees in line with your toes.' },
      { m: 'Your heels lift off the floor.', fix: 'Shift your weight to your midfoot and heel. If your ankles are stiff, take a slightly wider stance.' },
      { m: 'Your lower back rounds at the bottom.', fix: 'Only go as deep as you can with a flat back; depth improves with practice.' },
      { m: 'Your hips rise before your chest.', fix: 'Think about lifting your chest and hips together, not just pushing your hips up.' },
    ],
  },

  goblet: {
    why: 'A squat with the weight held in front of your body; it makes it easier to keep your torso upright and to learn proper depth.',
    setup: [
      'Hold the dumbbell vertically, both hands under its top head, tight against your breastbone.',
      'Elbows pointing down and close to your body.',
      'Feet slightly wider than shoulder width, toes turned out a little.',
    ],
    steps: [
      'Send your hips back and your knees forward and lower straight down.',
      'At the bottom, your elbows should sit between your knees.',
      'Press your feet into the floor to stand up, keeping the dumbbell tight against your chest.',
    ],
    cues: [
      'Keep the dumbbell against your chest the whole time.',
      'Keep your torso more upright than in a regular squat.',
      'At the bottom, use your elbows to push your knees out.',
      'Heels on the floor.',
    ],
    breath: 'Breathe in at the top, hold it on the way down, breathe out on the way up.',
    feel: 'Thighs, glutes and abs. If your lower back tires first, pick a lighter dumbbell.',
    mistakes: [
      { m: 'The dumbbell drifts away from your chest.', fix: 'Pin your upper arms to your ribs and press the dumbbell into your body.' },
      { m: 'Your torso leans too far forward.', fix: 'Use a lighter dumbbell and keep your chest up.' },
      { m: 'Your upper back rounds.', fix: 'Pull your shoulder blades slightly back and down and look straight ahead.' },
    ],
  },

  backsquat: {
    why: 'The strongest barbell lift for the lower body; builds strength and size in your thighs and glutes.',
    setup: [
      'Rest the bar on your traps (the muscle across the back of your shoulders), not on the bone at the base of your neck.',
      'Hands slightly wider than shoulder width, elbows pointing down.',
      'Unrack the bar, take two short steps back and set your feet slightly wider than shoulder width.',
    ],
    steps: [
      'Take a deep breath and brace your abs all the way around, like a belt.',
      'Hips back and knees forward; lower under control to parallel or slightly below.',
      'Push the floor away with your feet and drive the bar up in a straight vertical line.',
      'Breathe out at the top and take a fresh breath for the next rep.',
    ],
    cues: [
      'Keep the bar over your midfoot the whole time.',
      'Hips and shoulders rise together.',
      'Knees in line with your toes.',
      'Keep your neck in line with your spine; do not look at the ceiling.',
    ],
    breath: 'For every rep: a deep breath at the top, hold it through the movement, breathe out at the top.',
    feel: 'Thighs, glutes, and your whole core working to support the weight.',
    mistakes: [
      { m: 'Your hips rise before your shoulders and the lift turns into a forward bend.', fix: 'Reduce the weight and think about driving your back up into the bar.' },
      { m: 'Your knees cave in on the way up.', fix: 'Actively push your knees out; if you cannot, the weight is too heavy.' },
      { m: 'Your lower back rounds at the bottom.', fix: 'Reduce the depth and practice your breathing and bracing.' },
    ],
    safety: 'Always train with the safety bars of the rack or with a spotter. Learn the form with a light weight first.',
  },

  lunge: {
    why: 'Single-leg work for balance, glutes and thighs; the reverse lunge puts less stress on the front knee.',
    setup: [
      'Stand tall, feet hip-width apart.',
      'Hands on your hips or relaxed at your sides.',
    ],
    steps: [
      'Take a long step back and land on the ball of your back foot.',
      'Bend both knees until your back knee is a few centimeters above the floor.',
      'Press through the heel of your front foot to return to the start.',
      'Alternate legs, or do all the reps on one leg before switching.',
    ],
    cues: [
      'Keep most of your weight on the front leg.',
      'Keep your front knee over your ankle and do not let it fall inward.',
      'Keep your feet hip-width apart, like two train tracks, not on a single line.',
      'Keep your hips facing forward; do not let them rotate.',
      'Torso upright or leaning slightly forward.',
    ],
    breath: 'Breathe in on the way down, breathe out on the way up.',
    feel: 'Glute and front of the thigh of the front leg.',
    mistakes: [
      { m: 'You lose your balance.', fix: 'Place your feet on two separate lines, not one behind the other; practice next to a wall at first.' },
      { m: 'Your front knee caves inward.', fix: 'Keep the knee over your second toe; lower more slowly.' },
      { m: 'Your back knee slams into the floor.', fix: 'Lower under control and stop a few centimeters above the floor.' },
      { m: 'You push off with your back leg.', fix: 'The back leg is only there for balance; stand up through the heel of your front foot.' },
    ],
  },

  bridge: {
    why: 'Activates your glutes without loading your knees or lower back; great for beginners and anyone with knee pain.',
    setup: [
      'Lie on your back, knees bent, feet flat on the floor and hip-width apart.',
      'Keep your heels about a hand span away from your glutes.',
      'Arms at your sides, palms facing down.',
    ],
    steps: [
      'Brace your abs and tuck your pelvis slightly so your lower back moves toward the floor.',
      'Press through your heels and lift your hips until your shoulders, hips and knees form one line.',
      'Hold at the top for one to two seconds and squeeze your glutes hard.',
      'Lower slowly, one vertebra at a time.',
    ],
    cues: [
      'Push through your heels, not your toes.',
      'Keep your knees hip-width apart, neither flaring out nor caving in.',
      'Lift with your glutes, not by arching your lower back.',
      'Keep your weight on your shoulder blades, not your neck; keep your head still.',
    ],
    breath: 'Breathe out on the way up, breathe in on the way down.',
    feel: 'Glutes and a little hamstring. If you only feel your hamstrings, bring your feet a bit closer to your glutes.',
    mistakes: [
      { m: 'Your lower back arches and your glutes do not work.', fix: 'Tuck your pelvis before you lift and keep your ribs down.' },
      { m: 'Your knees flare out.', fix: 'Keep your knees parallel; you can squeeze a pillow between them.' },
      { m: 'Your hamstrings cramp.', fix: 'Bring your feet closer and push through your heels, not your toes.' },
    ],
  },

  rdl: {
    why: 'The best exercise for your hamstrings and glutes; it teaches the hip hinge, which protects your lower back when you pick things up.',
    setup: [
      'Stand with your feet hip-width apart, dumbbells in front of your thighs, palms facing your body.',
      'Knees slightly bent and soft, not locked.',
      'Shoulders back, back flat.',
    ],
    steps: [
      'Push your hips straight back, as if you were closing a door behind you with your glutes.',
      'Lower the dumbbells close to your thighs and shins until you feel a clear stretch in your hamstrings, usually just below the knees.',
      'Drive your hips forward and squeeze your glutes to return to standing.',
    ],
    cues: [
      'Keep your back flat from start to finish.',
      'Keep your knee angle almost constant throughout the movement.',
      'Keep the dumbbells close to your legs; do not let them drift away from your body.',
      'Keep your neck in line with your spine; look at the floor in front of your feet.',
    ],
    breath: 'Breathe in at the top and brace your abs, lower down, then breathe out on the way up.',
    feel: 'Hamstrings and glutes. If you feel it mostly in your lower back, reduce the depth.',
    mistakes: [
      { m: 'Your back rounds.', fix: 'Only go as far as your back stays flat; keep your chest open.' },
      { m: 'Your knees bend too much and the movement turns into a squat.', fix: 'Think about sending your hips back, not down.' },
      { m: 'The dumbbells drift away from your body.', fix: 'Slide the dumbbells almost along your thighs and shins.' },
      { m: 'You lean back at the top.', fix: 'Stop once you are standing tall; just squeeze your glutes.' },
    ],
    safety: 'If you have lower back pain, do this exercise with a light weight and with guidance from a coach.',
  },

  deadlift: {
    why: 'The fundamental full-body strength lift; it works your hamstrings, glutes, back and core all at once.',
    setup: [
      'Bar over your midfoot, about 3 centimeters from your shins. Feet hip-width apart.',
      'Bend down and grip the bar just outside your shins.',
      'Bring your shins forward until they touch the bar. Chest up, back flat.',
      'Arms straight; feel tension in your arms and back so there is no slack in the bar.',
    ],
    steps: [
      'Take a deep breath and brace your abs.',
      'Push the floor away with your feet; the bar travels up close to your shins.',
      'Once the bar passes your knees, drive your hips forward and stand all the way up.',
      'Return along the same path: hips back first, then bend your knees once the bar has passed them.',
    ],
    cues: [
      'The bar moves in a straight vertical line, tight against your legs.',
      'Hips and shoulders rise together.',
      'Elbows straight; your hands are just hooks.',
      'Stand tall at the top; do not lean back.',
    ],
    breath: 'For every rep: a deep breath, hold it through the movement, breathe out once you are standing.',
    feel: 'Hamstrings, glutes, back and forearms.',
    mistakes: [
      { m: 'Your back rounds.', fix: 'Reduce the weight, and flatten your back and brace your abs before you pull.' },
      { m: 'The bar drifts away from your body.', fix: 'Engage your lats, as if you were holding an orange in each armpit.' },
      { m: 'Your hips shoot up early and your lower back does all the pulling.', fix: 'Think about pushing the floor away with your legs, not pulling the bar.' },
      { m: 'You jerk the bar off the floor.', fix: 'Build tension first, then pull smoothly and steadily.' },
    ],
    safety: 'This is a technical lift; start with a very light weight and, if possible, learn it under the supervision of a coach.',
  },

  pushup: {
    why: 'The basic pushing exercise for your chest, triceps and shoulders; your core also works to keep your body straight.',
    setup: [
      'Hands slightly wider than shoulder width, wrists under your shoulders, fingers pointing forward.',
      'Feet together or slightly apart, up on your toes.',
      'Body in one straight line from head to heels; abs and glutes tight.',
    ],
    steps: [
      'Bend your elbows at about 45 degrees from your body.',
      'Lower your chest to a few centimeters above the floor.',
      'Push the floor away with your palms and return to the top.',
    ],
    cues: [
      'Keep your body like a straight plank; do not let your hips sag or pike up.',
      'Elbows at 45 degrees from your body, not flared straight out to the sides.',
      'Your chest should reach the floor before your face does.',
      'At the top, spread your shoulder blades slightly, as if pushing the floor away.',
      'Head in line with your body; look slightly ahead of your hands.',
    ],
    breath: 'Breathe in on the way down, breathe out on the way up.',
    feel: 'Chest, triceps and front of the shoulders; abs working to hold your body in line.',
    mistakes: [
      { m: 'Your hips sag and your lower back arches.', fix: 'Squeeze your glutes and brace your abs; if you cannot hold it, do them on your knees or with your hands on a table.' },
      { m: 'Your elbows flare out to 90 degrees.', fix: 'Bring your elbows in a little toward your ribs; this takes the stress off your shoulders.' },
      { m: 'You only do half the range of motion.', fix: 'Fewer reps, but full ones; your chest should come within a few centimeters of the floor.' },
      { m: 'Your head drops before your body.', fix: 'Tuck your chin back slightly and lead with your chest.' },
    ],
  },

  kneepush: {
    why: 'An easier version of the push-up with the same form; the first step toward a full push-up.',
    setup: [
      'Knees on the floor (put a towel or mat under them), hands slightly wider than shoulder width.',
      'Body in one straight line from head to knees; hips neither high nor low.',
      'You can lift your feet off the floor and cross them.',
    ],
    steps: [
      'Bend your elbows at 45 degrees from your body and lower your chest toward the floor.',
      'Push the floor away and return to the top.',
    ],
    cues: [
      'Straight line from head to knees; keep your glutes squeezed.',
      'Hands under your shoulders, not out in front of them.',
      'Full range of motion: chest close to the floor.',
      'Once 3 sets of 12 feel easy, move on to full push-ups.',
    ],
    breath: 'Breathe in on the way down, breathe out on the way up.',
    feel: 'Chest, triceps and shoulders.',
    mistakes: [
      { m: 'Your hips stay high and your body is bent.', fix: 'Bring your hips forward until your thighs and torso form one line.' },
      { m: 'Your hands are too far in front of your shoulders.', fix: 'Move your hands back until your wrists are under your shoulders.' },
    ],
  },

  floorpress: {
    why: 'A dumbbell chest press without a bench; the floor limits the range of motion and keeps your shoulders safer.',
    setup: [
      'Lie on your back, knees bent, feet flat on the floor.',
      'Dumbbells in your hands, upper arms on the floor at about 45 degrees from your body, forearms vertical.',
      'Pull your shoulder blades slightly together and press them into the floor.',
    ],
    steps: [
      'Press the dumbbells straight up over your chest.',
      'At the top, bring the dumbbells close together without letting them touch.',
      'Lower slowly until your upper arms settle gently on the floor; pause for a moment.',
    ],
    cues: [
      'Wrists straight and stacked over your elbows; do not let them bend back.',
      'Elbows at 45 degrees from your body.',
      'Shoulder blades pressed into the floor the whole time.',
      'Lower under control; do not slam your elbows into the floor.',
    ],
    breath: 'Breathe out as you press up, breathe in as you lower.',
    feel: 'Chest and triceps.',
    mistakes: [
      { m: 'Your elbows slam into the floor.', fix: 'Take two seconds to lower the weight.' },
      { m: 'Your wrists bend back.', fix: 'Keep the dumbbell over the heel of your palm, with a straight fist.' },
      { m: 'Your elbows flare all the way out to the sides.', fix: 'Bring your elbows in a little toward your body.' },
    ],
  },

  row: {
    why: 'A pulling exercise for your back muscles; it balances out your pushing work and helps keep your shoulders upright.',
    setup: [
      'Dumbbells in your hands, knees slightly bent.',
      'Hinge at the hips until your torso leans forward about 45 degrees or more; back flat.',
      'Arms hanging straight down under your shoulders.',
    ],
    steps: [
      'First pull your shoulder blades slightly back and down.',
      'Pull your elbows toward your hips, not straight up, until the dumbbells reach the sides of your stomach.',
      'Pause for one second and squeeze your shoulder blades together.',
      'Lower slowly until your arms are fully straight.',
    ],
    cues: [
      'Keep your torso still the whole time.',
      'Elbows close to your body.',
      'Keep your shoulders away from your ears.',
      'Your hands are just hooks; pull with your back.',
    ],
    breath: 'Breathe out as you pull, breathe in as you lower.',
    feel: 'Middle and upper back (between and below the shoulder blades), and a little in the back of the upper arms.',
    mistakes: [
      { m: 'Your torso rocks and you heave the weight up.', fix: 'Use a lighter weight and pause at the top.' },
      { m: 'Your back rounds.', fix: 'Bend your knees more and keep your chest open.' },
      { m: 'Your shoulders shrug up toward your ears.', fix: 'Pull your shoulder blades down before every rep.' },
    ],
    safety: 'If you have lower back pain, row one arm at a time with your other hand and one knee supported on a bench or chair.',
  },

  superman: {
    why: 'Strengthens the muscles along your spine and your glutes with no weights; good for posture and for preventing lower back pain.',
    setup: [
      'Lie face down on the floor, arms stretched out in front of your head, legs straight.',
      'Forehead close to the floor, neck in line with your body.',
    ],
    steps: [
      'Squeeze your glutes.',
      'Lift your arms, chest and legs a few centimeters off the floor at the same time.',
      'Hold for two to three seconds.',
      'Lower slowly and rest for a moment.',
    ],
    cues: [
      'A small lift is enough; going too high shifts the stress to your lower back.',
      'Look at the floor; do not lift your head.',
      'Move slowly and under control, with no jerking.',
      'Lift your legs with your glutes, not by bending your knees.',
    ],
    breath: 'Breathe out on the way up, and breathe gently during the hold.',
    feel: 'The muscles on both sides of your spine, your glutes and the back of your shoulders.',
    mistakes: [
      { m: 'Your head tilts back.', fix: 'Keep your eyes on the floor.' },
      { m: 'You jerk through the movement.', fix: 'Two seconds up, two seconds hold, two seconds down.' },
    ],
    safety: 'If you feel a sharp pain in your lower back, lift only your arms or only your legs.',
  },

  press: {
    why: 'Builds overhead strength in your shoulders and triceps; your core also works to keep your body stable.',
    setup: [
      'Stand with your feet hip-width apart.',
      'Dumbbells at shoulder height, palms facing forward or facing each other, elbows slightly in front of your body.',
      'Brace your abs and squeeze your glutes.',
    ],
    steps: [
      'Press the dumbbells straight up overhead.',
      'At the top, your arms should be next to your ears with the dumbbells over your head.',
      'Lower under control to shoulder height.',
    ],
    cues: [
      'Keep your ribs down; do not let your lower back arch.',
      'Wrists straight and stacked over your elbows.',
      'The dumbbells travel up, not forward.',
      'Knees straight but not locked; do not push with your legs.',
    ],
    breath: 'Breathe out as you press up, breathe in as you lower.',
    feel: 'Shoulders and triceps.',
    mistakes: [
      { m: 'Your lower back arches.', fix: 'Squeeze your glutes and brace your abs; if that does not fix it, use a lighter weight or press seated.' },
      { m: 'The dumbbells get pushed forward.', fix: 'Keep the dumbbells in a vertical line over your shoulders.' },
      { m: 'Your shoulders shrug up toward your ears.', fix: 'Bring your shoulders down at the bottom of each rep.' },
    ],
    safety: 'If raising your arms overhead hurts, shorten the range of motion or skip this exercise.',
  },

  plank: {
    why: 'Strengthens your deep abdominal muscles; you learn to keep your body straight and tight, which every exercise needs.',
    setup: [
      'Get onto your forearms and toes.',
      'Elbows directly under your shoulders, forearms parallel.',
      'Feet hip-width apart.',
    ],
    steps: [
      'Lift your body off the floor in a straight line.',
      'Brace your abs as if someone were about to punch you in the stomach.',
      'Squeeze your glutes and hold for the time while breathing calmly.',
    ],
    cues: [
      'One straight line from head to heels.',
      'Push the floor away with your forearms so your shoulders do not sink.',
      'Look at the floor, slightly ahead of your hands.',
      'Quality matters more than time; once your form breaks, the set is over.',
    ],
    breath: 'Breathe slowly and steadily; do not hold your breath.',
    feel: 'Abs, plus a little in your shoulders and glutes. If your lower back hurts, stop.',
    mistakes: [
      { m: 'Your lower back sags.', fix: 'Squeeze your glutes and tuck your pelvis slightly; or do it on your knees.' },
      { m: 'Your hips rise too high.', fix: 'Lower your hips until they are level with your shoulders.' },
      { m: 'You hold your breath.', fix: 'Count out loud; if you can count, you are breathing.' },
    ],
  },

  birddog: {
    why: 'Stability for your lower back and pelvis; a safe exercise that is often recommended for back pain too.',
    setup: [
      'On all fours: hands under your shoulders, knees under your hips.',
      'Back flat like a table; neck in line with your back.',
    ],
    steps: [
      'Brace your abs.',
      'Reach your right arm forward and your left leg back at the same time until they are in line with your body.',
      'Hold for two seconds.',
      'Return and repeat with your left arm and right leg.',
    ],
    cues: [
      'Keep your hips level, as if a glass of water were resting on your lower back.',
      'Reach your arm and leg long, not high.',
      'Go slowly; hold two seconds on each side.',
      'Push the floor away with your supporting hand.',
    ],
    breath: 'Breathe out as you reach, breathe in as you return.',
    feel: 'Abs, lower back muscles and glutes, with no pain.',
    mistakes: [
      { m: 'Your hips rotate to one side.', fix: 'Lift your leg less and brace your abs harder.' },
      { m: 'Your lower back arches.', fix: 'Raise your leg only to body height, no higher.' },
      { m: 'You rush through the movement.', fix: 'Count to two on each side.' },
    ],
  },

  crunch: {
    why: 'Direct work for the rectus abdominis, with a short, controlled range of motion.',
    setup: [
      'Lie on your back, knees bent, feet flat on the floor.',
      'Fingertips behind your ears, or arms crossed over your chest.',
    ],
    steps: [
      'Brace your abs.',
      'Use your abs to lift your head, shoulders and upper back a few centimeters.',
      'Pause at the top for one second.',
      'Lower slowly.',
    ],
    cues: [
      'Keep a fist-sized gap between your chin and your chest.',
      'Keep your lower back on the floor.',
      'A short movement is enough; you do not need to sit all the way up.',
      'Come up with your abs, not by pushing your head forward.',
    ],
    breath: 'Breathe out on the way up, breathe in on the way down.',
    feel: 'Abs. If your neck gets tired, place your hands on your chest.',
    mistakes: [
      { m: 'You pull on your head with your hands.', fix: 'Your hands only support your head; keep your elbows wide.' },
      { m: 'You come all the way up to sitting.', fix: 'Once your shoulder blades leave the floor, that is enough.' },
      { m: 'The movement is fast and swinging.', fix: 'One second up, one second pause, two seconds down.' },
    ],
  },

  jacks: {
    why: 'Warms you up and raises your heart rate while coordinating your arms and legs.',
    setup: [
      'Stand tall, feet together, arms at your sides.',
      'Knees slightly bent and soft.',
    ],
    steps: [
      'With a small jump, spread your feet slightly wider than shoulder width while raising your arms out to the sides and overhead.',
      'Jump again to return to the start.',
      'Keep going at a steady rhythm.',
    ],
    cues: [
      'Land softly on the balls of your feet.',
      'Keep your knees slightly bent as you land.',
      'A steady rhythm matters more than speed.',
      'If the impact bothers you, step one foot out to the side instead of jumping.',
    ],
    breath: 'Breathe steadily; you should be able to say a few words.',
    feel: 'A rising heart rate and warmth in your calves, thighs and shoulders.',
    mistakes: [
      { m: 'You land heavily on your heels.', fix: 'Land on the balls of your feet and keep your knees soft.' },
      { m: 'Your knees cave inward as you land.', fix: 'Spread your feet less and keep your knees in line with your toes.' },
    ],
  },

  highknees: {
    why: 'Intense cardio that raises your heart rate and strengthens your hip flexors.',
    setup: ['Stand tall, feet hip-width apart, arms ready to pump as if running.'],
    steps: [
      'Run in place, driving your knees up to hip height one at a time.',
      'Swing the opposite arm forward with each leg.',
    ],
    cues: [
      'Keep your torso upright; do not lean back.',
      'Land on the balls of your feet.',
      'Abs tight.',
      'If you get tired, slow down but keep your knees high.',
    ],
    breath: 'Breathe quickly but steadily.',
    feel: 'A high heart rate, the front of your thighs and your abs.',
    mistakes: [
      { m: 'Your torso leans back.', fix: 'Lean slightly forward and brace your abs.' },
      { m: 'Your knees stay low.', fix: 'Go slower, but at full height.' },
      { m: 'You land on your heels.', fix: 'Land lightly on the balls of your feet.' },
    ],
  },

  climber: {
    why: 'Cardio combined with ab and shoulder work; a mix of plank and running.',
    setup: [
      'Top of a push-up: hands under your shoulders, body straight from head to heels.',
    ],
    steps: [
      'Bring your right knee toward your chest.',
      'Send it back while bringing your left knee forward.',
      'Keep going in rhythm, like running in a push-up position.',
    ],
    cues: [
      'Keep your shoulders over your hands; do not let them drift back.',
      'Hips level with your body; do not let them pike up.',
      'Bring your knee all the way under your chest.',
      'Quality first, then speed.',
    ],
    breath: 'Breathe steadily; do not hold your breath.',
    feel: 'Abs, shoulders and a high heart rate.',
    mistakes: [
      { m: 'Your hips rise.', fix: 'Slow down and keep your hips level with your shoulders.' },
      { m: 'Your weight shifts back onto your feet.', fix: 'Keep your shoulders forward, over your wrists.' },
      { m: 'Only your feet move and your knees do not come forward.', fix: 'Really drive your knee all the way under your chest.' },
    ],
  },

  boxing: {
    why: 'Low-impact cardio that is easy on your knees and joints; your shoulders and core get worked too.',
    setup: [
      'Get into your guard: non-dominant foot forward, feet shoulder-width apart, knees slightly bent.',
      'Fists next to your chin, elbows close to your body.',
    ],
    steps: [
      'Throw a straight punch with your lead hand and snap it back quickly.',
      'Punch with your rear hand while pivoting slightly on your back heel and rotating your hips.',
      'Repeat this combination in rhythm.',
    ],
    cues: [
      'Power comes from your legs and hip rotation, not just your arms.',
      'After every punch, bring your hand back to guard next to your chin.',
      'Stay light on the balls of your feet.',
      'Give a short exhale with every punch.',
    ],
    breath: 'A short exhale with every punch; breathe normally between punches.',
    feel: 'Shoulders, abs and a rising heart rate.',
    mistakes: [
      { m: 'Your elbow locks out at the end of the punch.', fix: 'Keep your elbow slightly bent; punch at an imaginary target that is a little closer.' },
      { m: 'Your other hand drops out of guard.', fix: 'The hand that is not punching always stays next to your chin.' },
      { m: 'Your body is stiff and motionless.', fix: 'Keep your knees soft and let your hips rotate with each punch.' },
    ],
  },
  /* ---------- warm-up ---------- */
  march: {
    why: 'A gentle full-body warm-up that gradually raises your heart rate.',
    setup: ['Stand tall, feet hip-width apart.'],
    steps: ['March in place, lifting your knees to nearly hip height.', 'Swing your arms in time with your legs, as you would when walking.'],
    cues: ['Torso upright and abs lightly braced.', 'Start slowly and gradually pick up the pace.', 'Land on the balls of your feet.'],
    breath: 'Normal and steady.',
    feel: 'Your legs warming up and your heart rate rising slightly.',
    mistakes: [{ m: 'Your torso leans back.', fix: 'Stand leaning slightly forward and keep your abs braced.' }],
  },
  armcircle: {
    why: 'Prepares your shoulder joints for upper-body exercises.',
    setup: ['Stand tall, arms at your sides.'],
    steps: ['Swing your arms in big circles, up in front and down behind you.', 'Halfway through the time, reverse the direction.'],
    cues: ['Big, slow circles.', 'Do not shrug your shoulders up toward your ears.', 'Back straight; do not let your torso sway with your arms.'],
    breath: 'Normal and steady.',
    feel: 'Your shoulder joints warming up and loosening, with no pain.',
    mistakes: [{ m: 'The circles are small and fast.', fix: 'Use the full range and circle more slowly.' }],
  },
  legswing: {
    why: 'Opens up your hips and warms up your hamstrings before squats and deadlifts.',
    setup: ['Stand next to a wall and support yourself with one hand.', 'Stand on one leg, with the knee of the standing leg slightly bent.'],
    steps: ['Swing your free leg gently forward and back like a pendulum.', 'Gradually increase the range; then switch legs.'],
    cues: ['Keep your torso upright; do not let it bend with your leg.', 'Smooth movement, no jerking.', 'Half the time on each side.'],
    breath: 'Normal and steady.',
    feel: 'A gentle stretch in your hamstrings and the front of your hips.',
    mistakes: [{ m: 'You fling your leg up with a jerk.', fix: 'Reduce the range and swing gently.' }],
  },
  catcow: {
    why: 'Loosens up your spine and gets your back ready.',
    setup: ['On all fours: hands under your shoulders, knees under your hips.'],
    steps: ['As you breathe out, round your back up toward the ceiling like a cat and bring your chin toward your chest.', 'As you breathe in, gently lower your belly, open your chest and lift your gaze slightly.'],
    cues: ['Start the movement from your pelvis and let it travel up one vertebra at a time.', 'Slow and in time with your breath.', 'Push the floor away with your hands.'],
    breath: 'Breathe out as you round your back, breathe in as you arch.',
    feel: 'Your lower back and the area between your shoulder blades loosening up.',
    mistakes: [{ m: 'You arch too far and strain your lower back.', fix: 'Reduce the range; only go as far as feels comfortable.' }],
  },

  /* ---------- cool-down ---------- */
  hamstretch: {
    why: 'Eases hamstring tightness after your workout.',
    setup: ['Stand tall, knees slightly bent and soft.'],
    steps: ['Hinge forward at the hips and let your arms hang toward your feet.', 'Stop where you feel a gentle stretch and hold.'],
    cues: ['Bend from your hips, not your lower back.', 'It should be a gentle stretch, not pain.', 'Let go a little more with every exhale.'],
    breath: 'Slow and deep; do not hold your breath.',
    feel: 'A gentle stretch in your hamstrings.',
    mistakes: [{ m: 'You bounce to get lower.', fix: 'Stay still and just relax into it with your breath.' }],
  },
  quadstretch: {
    why: 'Stretches the front of your thighs and hips after lower-body exercises.',
    setup: ['Stand next to a wall and support yourself with one hand.'],
    steps: ['Bend one leg and grab your ankle with the hand on the same side.', 'Pull your heel toward your glutes and keep your knees together.', 'Hold for half the time, then switch legs.'],
    cues: ['Knees together; do not let the bent knee drift forward.', 'Squeeze your glutes slightly to deepen the stretch.', 'Torso upright.'],
    breath: 'Slow and deep.',
    feel: 'A stretch in the front of your thigh and the front of your hip.',
    mistakes: [{ m: 'Your lower back arches.', fix: 'Brace your abs and bring your hips slightly forward.' }],
    safety: 'If you have knee pain, do this stretch lying on your side.',
  },
  chestopen: {
    why: 'Opens up your chest and the front of your shoulders; especially good after pushing exercises or sitting at a desk.',
    setup: ['Stand tall and interlace your hands behind your back.'],
    steps: ['Gently move your clasped hands back and down.', 'Draw your shoulder blades together and open your chest; hold.'],
    cues: ['Shoulders down and away from your ears.', 'Do not let your lower back arch.', 'A gentle stretch.'],
    breath: 'Slow and deep.',
    feel: 'A stretch across the front of your chest and shoulders.',
    mistakes: [{ m: 'Your head juts forward.', fix: 'Tuck your chin back slightly so your neck is straight.' }],
  },
  childpose: {
    why: 'Active rest for your lower back and glutes at the end of the session.',
    setup: ['Kneel down, big toes close together, knees slightly apart.'],
    steps: ['Sit your hips back onto your heels.', 'Fold your torso forward and reach your arms out along the floor.', 'Rest your forehead on the floor and hold.'],
    cues: ['Relax your shoulders.', 'With every exhale, sink your hips back a little more.', 'Neck completely relaxed.'],
    breath: 'Slow and deep; send your breath into your back and sides.',
    feel: 'A gentle stretch in your lower back, glutes and under your arms.',
    mistakes: [{ m: 'Your hips do not reach your heels.', fix: 'Place a pillow between your hips and your heels.' }],
    safety: 'If you have knee pain, skip this exercise or put a pillow under your knees.',
  },
};
