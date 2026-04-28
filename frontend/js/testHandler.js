const QUESTIONS = [
  {
    text: 'Yeni insanlarla tanışmak bana enerji verir.',
    axis: 'E / I'
  },
  {
    text: 'Yoğun sosyal ortamlardan sonra yalnız kalmaya ihtiyaç duyarım.',
    axis: 'E / I'
  },
  {
    text: 'Grup içinde sohbet başlatmak benim için kolaydır.',
    axis: 'E / I'
  },
  {
    text: 'Düşüncelerimi paylaşmadan önce uzun süre içimde tartarım.',
    axis: 'E / I'
  },
  {
    text: 'Kalabalık etkinliklerde aktif rol almayı severim.',
    axis: 'E / I'
  },
  {
    text: 'Az ama derin ilişkiler kurmak bana daha doğal gelir.',
    axis: 'E / I'
  },
  {
    text: 'Somut bilgiler ve net örneklerle öğrenmeyi tercih ederim.',
    axis: 'S / N'
  },
  {
    text: 'Soyut fikirler ve geleceğe yönelik olasılıklar ilgimi çeker.',
    axis: 'S / N'
  },
  {
    text: 'Bir işi yaparken denenmiş yöntemlere güvenmeyi severim.',
    axis: 'S / N'
  },
  {
    text: 'Yeni ve alışılmadık fikirleri keşfetmek beni motive eder.',
    axis: 'S / N'
  },
  {
    text: 'Detayları fark etmek ve pratik çözümler üretmekte iyiyimdir.',
    axis: 'S / N'
  },
  {
    text: 'Bir konunun arkasındaki büyük resmi anlamaya çalışırım.',
    axis: 'S / N'
  },
  {
    text: 'Karar verirken mantık ve objektif analiz benim için önceliklidir.',
    axis: 'T / F'
  },
  {
    text: 'Karar verirken insanların duygularını ve etkilenme biçimini önemserim.',
    axis: 'T / F'
  },
  {
    text: 'Bir tartışmada tutarlılık ve kanıt benim için çok önemlidir.',
    axis: 'T / F'
  },
  {
    text: 'İnsanlar arasındaki uyumu korumak benim için önemlidir.',
    axis: 'T / F'
  },
  {
    text: 'Eleştirel düşünmek ve hataları açıkça görmek bana doğal gelir.',
    axis: 'T / F'
  },
  {
    text: 'Birinin kendini iyi hissetmesi bazen doğru cevaptan daha önemli olabilir.',
    axis: 'T / F'
  },
  {
    text: 'Planlı, düzenli ve önceden belirlenmiş programlarla çalışmayı severim.',
    axis: 'J / P'
  },
  {
    text: 'Esnek kalmayı ve duruma göre hareket etmeyi tercih ederim.',
    axis: 'J / P'
  },
  {
    text: 'Bir işi son tarihten önce tamamlamak beni rahatlatır.',
    axis: 'J / P'
  },
  {
    text: 'Ani değişiklikler ve spontane planlar bana keyif verir.',
    axis: 'J / P'
  },
  {
    text: 'Günlük hayatımda yapılacaklar listesi veya plan kullanmayı severim.',
    axis: 'J / P'
  },
  {
    text: 'Fırsatlar ortaya çıktıkça karar vermeyi daha doğal bulurum.',
    axis: 'J / P'
  }
];

const TOTAL_QUESTIONS = QUESTIONS.length;

const PERSONALITY_DETAILS = {
  INTJ: {
    title: 'Stratejik Mimar',
    description: 'Analitik, hedef odaklı ve uzun vadeli düşünen bir profil. Teknik topluluklar, proje grupları ve strateji odaklı ekiplerde güçlü katkı sağlayabilirsin.'
  },
  INTP: {
    title: 'Meraklı Analist',
    description: 'Teorik düşünmeyi, problem çözmeyi ve fikirleri sorgulamayı seven bir profil. Yazılım, araştırma ve teknoloji topluluklarında parlayabilirsin.'
  },
  ENTJ: {
    title: 'Doğal Lider',
    description: 'Organize, kararlı ve hedef merkezli bir profil. Topluluk yönetimi, girişimcilik ve ekip projelerinde öne çıkabilirsin.'
  },
  ENTP: {
    title: 'Yaratıcı Tartışmacı',
    description: 'Yeni fikirler üretmeyi, tartışmayı ve alternatif çözümler bulmayı seven bir profil. İnovasyon, startup ve beyin fırtınası grupları sana iyi gelebilir.'
  },
  INFJ: {
    title: 'Vizyoner Danışman',
    description: 'Anlam arayan, empatik ve derin bağlar kurmaya yatkın bir profil. Sosyal etki, gönüllülük ve fikir topluluklarında güçlü olabilirsin.'
  },
  INFP: {
    title: 'İdealist Yaratıcı',
    description: 'Değer odaklı, özgün ve yaratıcı bir profil. Sanat, yazı, müzik ve derin sohbet odaklı topluluklarda kendini rahat hissedebilirsin.'
  },
  ENFJ: {
    title: 'Topluluk Katalizörü',
    description: 'İnsan odaklı, destekleyici ve sosyal bir profil. Grup içi uyumu artırabilir, insanları bir araya getirebilirsin.'
  },
  ENFP: {
    title: 'Enerjik Keşifçi',
    description: 'Sosyal, yaratıcı ve yeni deneyimlere açık bir profil. Etkinlikler, sosyal kulüpler ve yaratıcı projelerde enerjinle öne çıkabilirsin.'
  },
  ISTJ: {
    title: 'Güvenilir Planlayıcı',
    description: 'Düzenli, sorumluluk sahibi ve pratik bir profil. Planlı çalışma gerektiren akademik ve teknik topluluklarda güvenilir rol üstlenebilirsin.'
  },
  ISFJ: {
    title: 'Destekleyici Koruyucu',
    description: 'Dikkatli, uyumlu ve yardımsever bir profil. Güvenli sosyal ortamlar ve destekleyici topluluklarda güçlü bağlar kurabilirsin.'
  },
  ESTJ: {
    title: 'Organizatör',
    description: 'Net, sonuç odaklı ve sistemli bir profil. Kulüp yönetimi, etkinlik organizasyonu ve ekip liderliği alanlarında başarılı olabilirsin.'
  },
  ESFJ: {
    title: 'Sosyal Birleştirici',
    description: 'Sıcakkanlı, işbirlikçi ve topluluk odaklı bir profil. İnsanların kendini ait hissettiği sosyal ortamlar oluşturabilirsin.'
  },
  ISTP: {
    title: 'Pratik Çözümleyici',
    description: 'Sakin, teknik ve deneyerek öğrenmeyi seven bir profil. Yazılım, donanım, spor veya uygulamalı projelerde etkili olabilirsin.'
  },
  ISFP: {
    title: 'Özgün Sanatçı',
    description: 'Estetik duyarlılığı yüksek, sakin ve özgün bir profil. Sanat, doğa ve yaratıcı ifade topluluklarında kendini gösterebilirsin.'
  },
  ESTP: {
    title: 'Aksiyon Odaklı Girişimci',
    description: 'Hızlı karar alan, enerjik ve deneyim odaklı bir profil. Spor, etkinlik ve pratik proje gruplarında güçlü olabilirsin.'
  },
  ESFP: {
    title: 'Sosyal Enerji Kaynağı',
    description: 'Eğlenceli, dışadönük ve deneyim odaklı bir profil. Sosyal etkinliklerde ve grup aktivitelerinde doğal olarak dikkat çekebilirsin.'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  renderQuestions();
  bindPersonalityTestEvents();
  updateProgress();
});

function renderQuestions() {
  const questionList = document.getElementById('questionList');

  if (!questionList) return;

  questionList.innerHTML = '';

  QUESTIONS.forEach((question, index) => {
    const card = document.createElement('article');
    card.className = 'question-card';
    card.dataset.axis = question.axis;

    const header = document.createElement('div');
    header.className = 'question-header';

    const questionIndex = document.createElement('span');
    questionIndex.className = 'question-index';
    questionIndex.textContent = String(index + 1).padStart(2, '0');

    const axisBadge = document.createElement('span');
    axisBadge.className = 'axis-badge';
    axisBadge.textContent = question.axis;

    header.appendChild(questionIndex);
    header.appendChild(axisBadge);

    const title = document.createElement('h3');
    title.textContent = question.text;

    const row = document.createElement('div');
    row.className = 'likert-row';
    row.dataset.question = index;

    for (let value = 1; value <= 5; value++) {
      const label = document.createElement('label');

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `q${index}`;
      input.value = value;
      input.required = true;

      const span = document.createElement('span');
      span.textContent = value;

      label.appendChild(input);
      label.appendChild(span);
      row.appendChild(label);
    }

    card.appendChild(header);
    card.appendChild(title);
    card.appendChild(row);

    questionList.appendChild(card);
  });
}

function bindPersonalityTestEvents() {
  const form = document.getElementById('personalityForm');
  const questionList = document.getElementById('questionList');

  if (questionList) {
    questionList.addEventListener('change', (event) => {
      if (event.target.matches('input[type="radio"]')) {
        markQuestionAnswered(event.target);
        updateProgress();
        scrollToNextQuestion(event.target);
      }
    });
  }

  if (form) {
    form.addEventListener('submit', submitPersonalityTest);
  }
}

function markQuestionAnswered(input) {
  const questionCard = input.closest('.question-card');

  if (!questionCard) return;

  questionCard.classList.add('answered');
}

function updateProgress() {
  const answeredCount = getAnsweredCount();
  const percentage = Math.round((answeredCount / TOTAL_QUESTIONS) * 100);

  const progressText = document.getElementById('progressText');
  const progressBar = document.getElementById('progressBar');
  const progressHint = document.getElementById('progressHint');
  const submitBtn = document.getElementById('submitTestBtn');

  if (progressText) {
    progressText.textContent = `${answeredCount}/${TOTAL_QUESTIONS}`;
  }

  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
  }

  if (progressHint) {
    if (answeredCount === TOTAL_QUESTIONS) {
      progressHint.textContent = 'Harika! Testi tamamlayıp sonucunu görebilirsin.';
    } else {
      progressHint.textContent = `${TOTAL_QUESTIONS - answeredCount} soru kaldı.`;
    }
  }

  if (submitBtn) {
    submitBtn.disabled = answeredCount !== TOTAL_QUESTIONS;
    submitBtn.textContent = answeredCount === TOTAL_QUESTIONS
      ? 'Testi Tamamla'
      : `${TOTAL_QUESTIONS - answeredCount} Soru Kaldı`;
  }
}

function getAnsweredCount() {
  let count = 0;

  for (let i = 0; i < TOTAL_QUESTIONS; i++) {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);

    if (selected) {
      count++;
    }
  }

  return count;
}

function getAnswers() {
  const answers = [];

  for (let i = 0; i < TOTAL_QUESTIONS; i++) {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);

    if (!selected) {
      return null;
    }

    answers.push(Number(selected.value));
  }

  return answers;
}

function scrollToNextQuestion(input) {
  const currentQuestionNumber = Number(input.name.replace('q', ''));
  const nextCard = document.querySelector(`input[name="q${currentQuestionNumber + 1}"]`)?.closest('.question-card');

  if (!nextCard) return;

  setTimeout(() => {
    nextCard.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }, 160);
}

async function submitPersonalityTest(event) {
  event.preventDefault();

  const answers = getAnswers();

  if (!answers) {
    showToast('Lütfen tüm soruları cevaplayın.', 'error');
    focusFirstUnansweredQuestion();
    return;
  }

  const submitBtn = document.getElementById('submitTestBtn');
  const originalText = submitBtn.textContent;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sonuç Hesaplanıyor...';

  const response = await authFetch(`${API_BASE}/api/test/personality`, {
    method: 'POST',
    body: JSON.stringify({ answers })
  });

  submitBtn.disabled = false;
  submitBtn.textContent = originalText;

  if (!response || !response.success) {
    showToast(response?.message || 'Kişilik testi gönderilemedi.', 'error');
    return;
  }

  const personalityType = response.data.personality_type;

  showToast('Kişilik testi başarıyla tamamlandı.', 'success');
  showResultModal(personalityType);
}

function focusFirstUnansweredQuestion() {
  for (let i = 0; i < TOTAL_QUESTIONS; i++) {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);

    if (!selected) {
      const card = document.querySelector(`input[name="q${i}"]`)?.closest('.question-card');

      if (card) {
        card.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        card.classList.add('question-warning');

        setTimeout(() => {
          card.classList.remove('question-warning');
        }, 1200);
      }

      break;
    }
  }
}

function showResultModal(type) {
  const modal = document.getElementById('resultModal');
  const resultType = document.getElementById('resultType');
  const resultTitle = document.getElementById('resultTitle');
  const resultDescription = document.getElementById('resultDescription');

  const detail = PERSONALITY_DETAILS[type] || {
    title: 'Kişilik Profili',
    description: 'Kişilik tipin hesaplandı. Bu sonuç topluluk önerilerinde ve profilinde kullanılacak.'
  };

  if (resultType) {
    resultType.textContent = type;
  }

  if (resultTitle) {
    resultTitle.textContent = detail.title;
  }

  if (resultDescription) {
    resultDescription.textContent = detail.description;
  }

  if (modal) {
    modal.classList.remove('hidden');
  }
}